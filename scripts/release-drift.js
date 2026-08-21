// Says, and only when it is true, "it is time to cut a release."
//
// The version number does not move on its own — `scripts/bump-version.js` runs
// when a person decides to run it. That is deliberate (a human picks WHEN and
// WHAT number, and CI never gets write access to `main`), and it is also how
// 0.9.0 sat unchanged from 18 July to 19 August while feature after feature
// shipped. Nothing anywhere reported that. This does.
//
// WHY IT MATTERS, given sw.js serves HTML network-first: an ONLINE rebbi
// already has every merge the moment it deploys, so this is not about getting
// changes to people. It is about the two things the number really drives —
// the "Check for updates" card, which otherwise tells a rebbi he is current
// when he is not, and `CACHE_VERSION`, which is what clears a stale OFFLINE
// copy. Neither is urgent; both are quietly wrong until a release is cut.
//
// SILENT UNLESS IT IS TIME. This is the whole design. A warning that prints
// every session becomes wallpaper inside a week, and then it is worse than
// nothing, because you would believe you were being told. It prints nothing
// at all until a threshold is actually crossed.
//
// Usage:
//   node scripts/release-drift.js           silent unless drifted
//   node scripts/release-drift.js --always  print the state either way
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ALWAYS = process.argv.includes("--always");

/* TWO thresholds, because two different things go wrong, in two different
 * seasons — Ben's own framing: "I'm building now during vacation, it'll be
 * less during school."
 *
 *   MERGES — the burst guard. During a school holiday this repo has done 48
 *            merges in two days. Time says nothing then; volume does.
 *   DAYS   — the quiet guard. In term time weeks pass with a handful of
 *            merges, and the count would never trip. This is what would have
 *            caught the month-long 0.9.0 gap about four days in.
 *
 * Whichever comes first. If the merge count starts feeling like nagging in a
 * heavy stretch, raise MERGES — it is one number, right here. */
const MERGES = 30;
const DAYS = 7;

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}

// Resolve the main repo, not whichever worktree happens to be the cwd — the
// same trap that made wip-audit offer to delete the shared checkout.
let REPO = null;
{
  const common = (function () {
    try {
      return execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch (e) { return null; }
  })();
  if (!common) process.exit(0); // not a git repo: say nothing, ever
  REPO = path.dirname(common.replace(/\\/g, "/"));
}

/* Deliberately no `git fetch`. This runs on every session start, and the
 * hooks that run beside it (sync-main-checkout, testbench) already fetch — so
 * origin/main is fresh in practice, and a second network call per session
 * would be pure cost. A few merges stale cannot flip a 30-merge threshold. */
const ref = git(["rev-parse", "--verify", "--quiet", "origin/main"]) ? "origin/main" : "main";

// The release itself: version.json is the file bump-version.js stamps, so the
// commit that last touched it IS the last release.
let version = "?";
try {
  version = JSON.parse(fs.readFileSync(path.join(REPO, "version.json"), "utf8")).version || "?";
} catch (e) {}

const lastBump = git(["log", "-1", "--format=%H %cI", ref, "--", "version.json"]);
if (!lastBump) process.exit(0);
const [sha, iso] = lastBump.split(" ");

const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
const mergesStr = git(["rev-list", "--count", "--merges", sha + ".." + ref]);
const merges = mergesStr ? parseInt(mergesStr, 10) || 0 : 0;

const drifted = merges >= MERGES || days >= DAYS;
if (!drifted && !ALWAYS) process.exit(0); // the silent path, and the common one

/* Suggest a number by reading what [Unreleased] actually claims, per Keep a
 * Changelog: anything under `### Added` or `### Changed` is a minor; only
 * fixes is a patch. A SUGGESTION — the call is the maintainer's, because only
 * a person knows whether a change is big for a rebbi. */
let bump = "patch", nextVer = version;
try {
  const cl = fs.readFileSync(path.join(REPO, "CHANGELOG.md"), "utf8");
  const start = cl.indexOf("## [Unreleased]");
  const rest = cl.slice(start + 1);
  const end = rest.indexOf("\n## [");
  const unreleased = end < 0 ? rest : rest.slice(0, end);
  if (/^###\s+(Added|Changed)/m.test(unreleased)) bump = "minor";
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    nextVer = bump === "minor"
      ? m[1] + "." + (parseInt(m[2], 10) + 1) + ".0"
      : m[1] + "." + m[2] + "." + (parseInt(m[3], 10) + 1);
  }
} catch (e) {}

const why = [];
if (merges >= MERGES) why.push(merges + " merges");
if (days >= DAYS) why.push(days + " day" + (days === 1 ? "" : "s"));

console.log("");
console.log("  RELEASE DRIFT — " + version + " was cut " + days + " day" + (days === 1 ? "" : "s") +
            " ago, " + merges + " merges back.");
// `why` is empty only under --always while still inside both thresholds —
// the state the hook stays silent for. Say so, rather than printing "on: ."
console.log(why.length
  ? "  Past the line on: " + why.join(" and ") + ".  (thresholds: " + MERGES + " merges / " + DAYS + " days)"
  : "  Inside both thresholds (" + MERGES + " merges / " + DAYS + " days) — nothing owed; shown only because of --always.");
console.log("  [Unreleased] reads like a " + bump.toUpperCase() + " — suggests " + nextVer + ", but that call is yours.");
console.log("");
console.log("      node scripts/bump-version.js " + nextVer);
console.log("");
console.log("  Why bother, when an online rebbi already has every merge: it fixes the");
console.log("  \"Check for updates\" card (which currently says he is current when he is");
console.log("  not) and bumps CACHE_VERSION, which is what clears a stale offline copy.");
console.log("");
