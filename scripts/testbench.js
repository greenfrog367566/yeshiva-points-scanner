// Guarantees there is a FOLDER ON DISK for every branch worth testing, so
// looking at a change never requires knowing a git command.
//
// The problem this solves: a branch is not a thing you can open. Work that is
// pushed and PR'd still lives nowhere you can double-click, and a spike built
// to answer "does this feel right?" cannot answer it from a branch name. On
// 2026-08-20 a spike was pushed, the worktree was switched back to the PR
// branch, and the spike then existed on disk nowhere at all — correct git
// hygiene, useless for the person who wanted to click it.
//
// What it does: one worktree per OPEN PR, plus one per `spike/*` branch,
// named after the branch. Run it whenever; it is idempotent.
//
// WHY THIS DOES NOT RECREATE THE 92-WORKTREE SPRAWL: the set is bounded by
// things that are alive. Open PRs are capped at 5 (CLAUDE.md → "Finishing
// work"), and spikes are few and short-lived. A merged PR simply stops being
// a target, so the pile cannot grow past what is actually in flight.
//
// IT ONLY EVER ADDS. It never removes a worktree, never deletes a branch,
// never checks anything out over your work. Removal stays a list-and-ask step
// in `wip-audit.js --stale`, because a worktree is exactly where uncommitted
// work hides — the same script run that found this need also found 749
// uncommitted lines that a sweep would have destroyed.
//
// Usage:
//   node scripts/testbench.js            create anything missing
//   node scripts/testbench.js --dry-run  say what it would create, do nothing
//   node scripts/testbench.js --list     just show branch -> folder, no changes
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const LIST_ONLY = args.includes("--list");

function git(a, opts) {
  try {
    return execFileSync("git", a, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", opts && opts.showErr ? "inherit" : "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}
function gh(a) {
  try {
    return execFileSync("gh", a, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}

// Always operate on the MAIN repo root, never on whichever worktree happens to
// be the cwd — `git worktree add` from inside a worktree is legal but the
// relative paths get confusing fast.
const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
if (!commonDir) {
  console.error("Not a git repository.");
  process.exit(1);
}
const repoRoot = path.dirname(commonDir.replace(/\\/g, "/"));
const wtRoot = path.join(repoRoot, ".claude", "worktrees");

git(["fetch", "origin", "--prune", "--quiet"]);

// --- what deserves a folder -------------------------------------------------
const targets = new Map(); // branch -> why

let ghWorked = false;
const raw = gh(["pr", "list", "--state", "open", "--limit", "50", "--json", "number,headRefName,title,isDraft"]);
if (raw) {
  try {
    JSON.parse(raw).forEach((pr) => targets.set(pr.headRefName, "PR #" + pr.number));
    ghWorked = true;
  } catch (e) {}
}

// Spikes exist precisely to be clicked, so they always get a folder — with or
// without a PR, and they usually have none by design (a spike on top of an
// unmerged branch would be a stacked PR, which this repo forbids).
const remotes = git(["branch", "-r", "--format=%(refname:short)"]) || "";
remotes.split(/\r?\n/).forEach((r) => {
  const name = r.trim().replace(/^origin\//, "");
  if (/^spike\//.test(name) && !targets.has(name)) targets.set(name, "spike");
});

if (!targets.size) {
  console.log("Nothing in flight — no open PRs and no spike/* branches.");
  if (!ghWorked) console.log("(`gh` unavailable, so open PRs could not be read.)");
  process.exit(0);
}

// --- where each branch already lives ---------------------------------------
const checkedOut = new Map(); // branch -> worktree path
{
  const porcelain = git(["worktree", "list", "--porcelain"]) || "";
  let cur = null;
  porcelain.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("worktree ")) cur = line.slice(9).trim();
    else if (line.startsWith("branch ") && cur)
      checkedOut.set(line.slice(7).replace("refs/heads/", "").trim(), cur);
  });
}

// Folder name mirrors the branch, with `/` written as `+` — the same
// transliteration EnterWorktree uses, so the two conventions agree.
const folderFor = (branch) => path.join(wtRoot, branch.replace(/\//g, "+"));

const rows = [];
const toCreate = [];

for (const [branch, why] of targets) {
  const want = folderFor(branch);
  const have = checkedOut.get(branch);
  if (have) {
    const norm = (p) => p.replace(/\\/g, "/").toLowerCase();
    rows.push({
      branch,
      why,
      folder: have,
      state: norm(have) === norm(want) ? "ok" : "ok (folder name differs)",
    });
  } else if (fs.existsSync(want)) {
    rows.push({ branch, why, folder: want, state: "PATH TAKEN — not a worktree, skipped" });
  } else {
    rows.push({ branch, why, folder: want, state: DRY || LIST_ONLY ? "would create" : "creating" });
    toCreate.push({ branch, want });
  }
}

// --- create -----------------------------------------------------------------
if (!LIST_ONLY && !DRY) {
  for (const { branch, want } of toCreate) {
    const localExists = git(["rev-parse", "--verify", "--quiet", "refs/heads/" + branch]);
    const ok = localExists
      ? git(["worktree", "add", want, branch], { showErr: true })
      : git(["worktree", "add", "--track", "-b", branch, want, "origin/" + branch], { showErr: true });
    const row = rows.find((r) => r.branch === branch);
    row.state = ok === null ? "FAILED" : "created";
  }
}

// --- report -----------------------------------------------------------------
const pad = (s, n) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const wB = Math.max(6, ...rows.map((r) => r.branch.length));
const wW = Math.max(3, ...rows.map((r) => r.why.length));

console.log("");
console.log("  TESTBENCH — a folder on disk for everything in flight");
console.log("  " + "-".repeat(66));
for (const r of rows) {
  console.log("  " + pad(r.branch, wB) + "  " + pad(r.why, wW) + "  " + r.state);
  console.log("  " + " ".repeat(wB + wW + 4) + r.folder.replace(/\\/g, "/"));
}
console.log("");
if (!ghWorked) {
  console.log("  ! `gh` unavailable — open PRs were NOT included, only spike/* branches.");
}
console.log("  Open app.html inside any of these directly; the seating chart and");
console.log("  most of the app work over file://. Only test-migration.html needs");
console.log("  a server (it uses fetch).");
console.log("");
console.log("  This never removes anything. To find dead worktrees:");
console.log("      node scripts/wip-audit.js --stale");
console.log("");
