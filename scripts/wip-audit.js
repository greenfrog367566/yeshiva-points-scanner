// Shows the TRUE state of work in flight — not the intended state.
//
// docs/NOW.md records what we meant to do. CHANGELOG.md records what shipped.
// Nothing recorded the gap between them, and that gap is where this repo
// actually loses work. The 2026-08-20 audit that prompted this script found,
// in a repo that looked healthy: 92 worktrees of which 81 were dead, 8 remote
// branches whose content had never landed, 7 PRs closed without merging after
// the work was done, 5 branches carrying commits main has never seen, and
// three worktrees holding uncommitted changes no list anywhere mentioned —
// one of them 749 lines of finished seating-tables work, one `rm` from gone.
// Throughput was never the problem: ~100 PRs merged in the preceding
// fortnight. Finishing was.
//
// KNOWN LIMIT, stated because a false "safe" here deletes real work: the
// never-landed check is a DATE test (commits newer than the PR's mergedAt),
// so it catches work pushed after a merge but NOT work whose commit predates
// the merge yet still never reached main — a PR that merged an earlier state
// of the branch, say. A hand audit the same day caught one of those
// (fix+seats-fullscreen-topbar) by grepping main for a line the commit adds.
// Only a content check can find that class, which is the branch-merge-audit
// skill's job. Treat every lane here as "look at this", never as a verdict.
//
// So this script answers the question NOW.md structurally cannot: "what is
// half-baked right now?" It reads git and `gh` only. It never writes, never
// commits, never removes a worktree, and never touches a branch — everything
// destructive it can see, it prints as a command for a human to run.
//
// Usage:
//   node scripts/wip-audit.js              the audit
//   node scripts/wip-audit.js --stale      + every stale worktree and the
//                                            exact removal commands (still
//                                            does not run them)
//   node scripts/wip-audit.js --no-fetch   skip the origin/main refresh
//   node scripts/wip-audit.js --json       machine-readable, for a hook
//
// Takes ~10-20s: it runs `git status` once per worktree, and there are a lot
// of worktrees. That cost IS the finding, and it shrinks as they get cleaned up.
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const SHOW_STALE = args.includes("--stale");
const AS_JSON = args.includes("--json");
const NO_FETCH = args.includes("--no-fetch");

// The cap is a rule, not a suggestion — see CLAUDE.md's "Finishing work"
// section. Open PRs against a single 22k-line app.html are inventory that
// rots: any two that touch it conflict by construction, so the pile does not
// just sit there, it actively costs more the longer it stands.
const WIP_CAP = 5;
// A draft nobody has touched for this long is not in flight, it is forgotten.
const STALE_PR_DAYS = 7;

function git(cmdArgs, cwd) {
  try {
    return execFileSync("git", cmdArgs, {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}

function gh(cmdArgs) {
  try {
    return execFileSync("gh", cmdArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}

const repoRoot = git(["rev-parse", "--show-toplevel"]);
if (!repoRoot) {
  console.error("Not a git repository.");
  process.exit(1);
}

if (!NO_FETCH) git(["fetch", "origin", "main", "--quiet"]);

// ---------------------------------------------------------------------------
// Pull every PR once. One call answers three different questions below, and
// it is also the only way to see a SQUASH-merged branch as merged: a squash
// strips ancestry, so `git merge-base --is-ancestor` reports a fully-landed
// branch as unmerged. See CLAUDE.md and the branch-merge-audit skill.
// ---------------------------------------------------------------------------
let prs = [];
let ghWorked = false;
{
  // Retried once on purpose. A transient `gh` failure (rate limit, a blip) is
  // not harmless here: with no PR data every branch looks unmatched, and the
  // counts inflate rather than erroring — one observed run reported 10 orphans
  // and 25 maybe-unlanded where the truth was 5 and 8. Silent inflation in a
  // report people act on is worse than no report, so: retry, then say so
  // loudly in BOTH the header and the final verdict if it still failed.
  for (let attempt = 0; attempt < 2 && !ghWorked; attempt++) {
    const raw = gh([
      "pr", "list", "--state", "all", "--limit", "400",
      "--json", "number,title,state,isDraft,mergedAt,createdAt,updatedAt,headRefName,mergeStateStatus,mergeable,additions,deletions,changedFiles",
    ]);
    if (raw) {
      try {
        prs = JSON.parse(raw);
        ghWorked = true;
      } catch (e) {
        prs = [];
      }
    }
  }
}

// Latest PR per head branch — a branch can carry more than one over its life.
const prByBranch = new Map();
for (const pr of prs) {
  const seen = prByBranch.get(pr.headRefName);
  if (!seen || pr.number > seen.number) prByBranch.set(pr.headRefName, pr);
}

const openPRs = prs
  .filter((p) => p.state === "OPEN")
  .sort((a, b) => a.number - b.number);

// Closed, never merged, and recent enough to still be worth a decision.
const abandonedPRs = prs
  .filter((p) => p.state === "CLOSED" && !p.mergedAt)
  .sort((a, b) => b.number - a.number)
  .slice(0, 10);

const now = Date.now();
const daysSince = (iso) =>
  iso ? Math.floor((now - Date.parse(iso)) / 86400000) : null;

// ---------------------------------------------------------------------------
// Worktrees: the layer where work goes quiet. A dirty or never-pushed worktree
// is invisible to `gh`, invisible to NOW.md, and disappears entirely if the
// worktree is cleaned up — which is exactly what the stale-worktree sweep
// this script also recommends would do to it.
// ---------------------------------------------------------------------------
function parseWorktrees() {
  const raw = git(["worktree", "list", "--porcelain"]) || "";
  const out = [];
  let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (cur) out.push(cur);
      cur = { path: line.slice(9).trim(), branch: null, head: null, locked: false, lockReason: "" };
    } else if (!cur) {
      continue;
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice(7).replace("refs/heads/", "").trim();
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice(5).trim();
    } else if (line.startsWith("locked")) {
      cur.locked = true;
      cur.lockReason = line.slice(6).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

const mainPath = repoRoot.replace(/\\/g, "/");
const worktrees = parseWorktrees().filter(
  (w) => w.path.replace(/\\/g, "/").toLowerCase() !== mainPath.toLowerCase()
);

// A worktree directory encodes its ORIGINAL branch name, which may differ from
// the branch it carries now: EnterWorktree creates `worktree-feat+x`, and
// CLAUDE.md requires renaming it to `feat/x` immediately. Sessions that forgot
// leave the two out of step, so match on both before calling anything orphaned.
function branchNamesFor(w) {
  const names = new Set();
  if (w.branch) names.add(w.branch);
  const dir = w.path.replace(/\\/g, "/").split("/").pop();
  if (dir) {
    names.add(dir.replace(/\+/g, "/"));
    names.add(dir.replace(/^worktree-/, "").replace(/\+/g, "/"));
  }
  return [...names];
}

const dirty = [];
const unpushed = [];
const orphaned = [];
const staleWorktrees = [];
const activeWorktrees = [];

for (const w of worktrees) {
  const status = git(["status", "--porcelain"], w.path);
  const isDirty = status === null ? false : status.length > 0;
  const dirtyCount = isDirty ? status.split(/\r?\n/).filter(Boolean).length : 0;

  const upstream = git(["rev-parse", "--abbrev-ref", "@{u}"], w.path);
  let ahead = 0;
  if (upstream) {
    const n = git(["rev-list", "--count", "@{u}..HEAD"], w.path);
    ahead = n ? parseInt(n, 10) || 0 : 0;
  }
  // Never pushed at all: no upstream AND commits of its own beyond main.
  let unpushedCommits = 0;
  if (!upstream) {
    const n = git(["rev-list", "--count", "origin/main..HEAD"], w.path);
    unpushedCommits = n ? parseInt(n, 10) || 0 : 0;
  }

  const names = branchNamesFor(w);
  const pr = names.map((n) => prByBranch.get(n)).find(Boolean) || null;

  const ancestorOfMain =
    w.head &&
    git(["merge-base", "--is-ancestor", w.head, "origin/main"]) !== null;

  // A MERGED PR is NOT proof the branch's content landed, and treating it as
  // proof is how a sweep deletes real work. A 2026-08-20 hand audit found six
  // worktrees whose PRs were merged but which still carried commits main had
  // never seen — commits pushed AFTER the merge, which no PR ever carried.
  //
  // Committer date vs. the PR's mergedAt catches exactly that, cheaply: a
  // commit newer than the merge cannot possibly have been in it. (Commits
  // OLDER than the merge are left alone — a squash strips ancestry, so they
  // look unmerged whether or not they landed, and only a content check can
  // tell. That is the branch-merge-audit skill's job, not this script's.)
  let orphanCommits = 0;
  const aheadOfMain = git(["rev-list", "--count", "origin/main..HEAD"], w.path);
  const commitsAheadOfMain = aheadOfMain ? parseInt(aheadOfMain, 10) || 0 : 0;
  if (commitsAheadOfMain > 0) {
    if (pr && pr.state === "MERGED" && pr.mergedAt) {
      const mergedMs = Date.parse(pr.mergedAt);
      const dates = git(["log", "origin/main..HEAD", "--format=%cI"], w.path);
      if (dates) {
        orphanCommits = dates
          .split(/\r?\n/)
          .filter(Boolean)
          .filter((d) => Date.parse(d) > mergedMs).length;
      }
    } else if (!pr || pr.state === "CLOSED") {
      // No PR ever, or a PR that closed unmerged: every commit is suspect.
      orphanCommits = commitsAheadOfMain;
    }
  }

  const landed = (ancestorOfMain || (pr && pr.state === "MERGED")) && orphanCommits === 0;
  const hasLooseWork = isDirty || ahead > 0 || unpushedCommits > 0 || orphanCommits > 0;

  const rec = {
    path: w.path,
    branch: w.branch,
    locked: w.locked,
    lockReason: w.lockReason,
    dirtyCount,
    ahead,
    unpushedCommits,
    orphanCommits,
    commitsAheadOfMain,
    hasUpstream: !!upstream,
    pr: pr ? { number: pr.number, state: pr.state, isDraft: pr.isDraft } : null,
    landed: !!landed,
  };

  if (isDirty) dirty.push(rec);
  if (ahead > 0 || unpushedCommits > 0) unpushed.push(rec);
  if (orphanCommits > 0) orphaned.push(rec);

  // The CLAUDE.md removal test, exactly: landed, unlocked, clean, nothing loose.
  if (landed && !w.locked && !hasLooseWork) staleWorktrees.push(rec);
  else activeWorktrees.push(rec);
}

// ---------------------------------------------------------------------------
// Remote branches carrying content that never landed. Ancestry alone cannot
// prove this (squash-merges), so anything with a MERGED PR is excluded and the
// rest is reported as "check me", never as "unmerged".
// ---------------------------------------------------------------------------
const unlandedBranches = [];
{
  const raw = git(["branch", "-r", "--no-merged", "origin/main", "--format=%(refname:short)"]) || "";
  for (const line of raw.split(/\r?\n/)) {
    const name = line.trim();
    if (!name || name.includes("HEAD")) continue;
    const short = name.replace(/^origin\//, "");
    if (short === "main") continue;
    const pr = prByBranch.get(short);
    if (pr && pr.state === "MERGED") continue; // squash-merged, content landed
    if (pr && pr.state === "OPEN") continue; // already counted as in-flight
    unlandedBranches.push({
      branch: short,
      pr: pr ? { number: pr.number, state: pr.state } : null,
    });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const summary = {
  openPRs: openPRs.length,
  wipCap: WIP_CAP,
  overCap: Math.max(0, openPRs.length - WIP_CAP),
  dirtyWorktrees: dirty.length,
  unpushedWorktrees: unpushed.length,
  orphanedWorktrees: orphaned.length,
  abandonedPRs: abandonedPRs.length,
  unlandedBranches: unlandedBranches.length,
  staleWorktrees: staleWorktrees.length,
  totalWorktrees: worktrees.length,
  ghAvailable: ghWorked,
};

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { summary, openPRs, dirty, unpushed, orphaned, abandonedPRs, unlandedBranches, staleWorktrees },
      null,
      2
    )
  );
  process.exit(0);
}

const L = (s) => console.log(s);
const rule = () => L("-".repeat(72));

L("");
L("  WIP AUDIT — the true state, not the intended one");
rule();

if (!ghWorked) {
  L("  ! `gh` unavailable or unauthenticated — PR lanes are empty and stale-");
  L("    worktree detection falls back to ancestry only, which UNDERCOUNTS");
  L("    squash-merged branches. Run `gh auth status` before trusting this.");
  L("");
}

// 1. Open PRs vs the cap.
L("");
L(`  OPEN PRS — ${openPRs.length} of ${WIP_CAP} allowed`);
if (openPRs.length > WIP_CAP) {
  L(`  ! OVER CAP by ${openPRs.length - WIP_CAP}. Merge or close before starting anything new.`);
}
if (!openPRs.length) L("    (none)");
for (const pr of openPRs) {
  const age = daysSince(pr.createdAt);
  const idle = daysSince(pr.updatedAt);
  const flags = [];
  if (pr.isDraft) flags.push("draft");
  if (pr.mergeStateStatus === "DIRTY") flags.push("CONFLICTS");
  if (pr.mergeStateStatus === "BLOCKED") flags.push("blocked");
  if (pr.mergeStateStatus === "BEHIND") flags.push("behind");
  if (idle !== null && idle >= STALE_PR_DAYS) flags.push(`idle ${idle}d`);
  const mark = pr.mergeStateStatus === "DIRTY" || (idle !== null && idle >= STALE_PR_DAYS) ? "!" : "*";
  L(`  ${mark} #${pr.number}  ${pr.title}`);
  L(`      ${age}d old · ${pr.changedFiles} files · +${pr.additions}/-${pr.deletions}${flags.length ? " · " + flags.join(", ") : ""}`);
}

// 2. Uncommitted work — the most losable thing here.
L("");
L(`  UNCOMMITTED WORK — ${dirty.length} worktree(s)`);
if (!dirty.length) L("    (none)");
for (const w of dirty) {
  L(`  ! ${w.branch || "(detached)"} — ${w.dirtyCount} changed file(s)${w.locked ? " · LIVE SESSION" : ""}`);
  L(`      ${w.path}`);
}

// 3. Committed but never pushed — vanishes with the worktree.
L("");
L(`  UNPUSHED COMMITS — ${unpushed.length} worktree(s)`);
if (!unpushed.length) L("    (none)");
for (const w of unpushed) {
  const n = w.ahead || w.unpushedCommits;
  const how = w.hasUpstream ? `${n} commit(s) ahead of remote` : `${n} commit(s), no remote branch at all`;
  L(`  ! ${w.branch || "(detached)"} — ${how}`);
  L(`      ${w.path}`);
}

// 3b. Pushed, but the content never reached main. The nastiest lane: these
//     look completely finished from `gh` and from NOW.md.
L("");
L(`  COMMITS THAT NEVER LANDED — ${orphaned.length} worktree(s)`);
if (!orphaned.length) L("    (none)");
else {
  L("    Pushed and PR-shaped, but main does not have this content. Verify each");
  L("    with the branch-merge-audit skill before assuming either way.");
}
for (const w of orphaned) {
  const why =
    w.pr && w.pr.state === "MERGED"
      ? `${w.orphanCommits} commit(s) pushed AFTER PR #${w.pr.number} merged`
      : w.pr
      ? `${w.orphanCommits} commit(s), PR #${w.pr.number} ${w.pr.state} unmerged`
      : `${w.orphanCommits} commit(s), no PR ever opened`;
  L(`  ! ${w.branch || "(detached)"} — ${why}`);
  L(`      ${w.path}`);
}

// 4. Work that was done, then dropped.
L("");
L(`  CLOSED WITHOUT MERGING — ${abandonedPRs.length} recent`);
if (!abandonedPRs.length) L("    (none)");
for (const pr of abandonedPRs) {
  L(`  - #${pr.number}  ${pr.title}  (${daysSince(pr.createdAt)}d ago)`);
}

// 5. Branches whose content may never have landed.
L("");
L(`  BRANCHES POSSIBLY NEVER LANDED — ${unlandedBranches.length}`);
if (!unlandedBranches.length) L("    (none)");
else {
  L("    Not an ancestor of main and no open/merged PR. Squash-merges hide");
  L("    content, so confirm with the branch-merge-audit skill before deleting.");
}
for (const b of unlandedBranches.slice(0, 25)) {
  L(`  - ${b.branch}${b.pr ? `  (PR #${b.pr.number} ${b.pr.state})` : "  (no PR ever)"}`);
}
if (unlandedBranches.length > 25) L(`    ...and ${unlandedBranches.length - 25} more`);

// 6. Stale worktrees — counted always, listed on request, removed never.
L("");
L(`  STALE WORKTREES — ${staleWorktrees.length} of ${worktrees.length} are dead`);
if (staleWorktrees.length) {
  L("    Landed, unlocked, clean. Safe to propose for removal — this script");
  L("    will not remove them, and neither should a session without asking.");
  if (SHOW_STALE) {
    for (const w of staleWorktrees) L(`  - ${w.branch || w.path}`);
    L("");
    L("    Removal commands (review, then run yourself):");
    for (const w of staleWorktrees) L(`      git worktree remove "${w.path}"`);
  } else {
    L("    Re-run with --stale for the list and the removal commands.");
  }
}

// The one-line verdict.
L("");
rule();
const problems = [];
if (summary.overCap > 0) problems.push(`${summary.overCap} PR(s) over cap`);
if (dirty.length) problems.push(`${dirty.length} dirty`);
if (unpushed.length) problems.push(`${unpushed.length} unpushed`);
if (orphaned.length) problems.push(`${orphaned.length} never landed`);
if (unlandedBranches.length) problems.push(`${unlandedBranches.length} maybe-unlanded`);
if (staleWorktrees.length) problems.push(`${staleWorktrees.length} stale worktrees`);
if (!ghWorked) {
  L("  ! NUMBERS NOT TRUSTWORTHY — `gh` failed twice, so every branch looked");
  L("    unmatched and the counts above are INFLATED, not merely incomplete.");
  L("    Fix `gh auth status` and re-run before acting on any of this.");
} else {
  L(problems.length ? `  NEEDS ATTENTION: ${problems.join(" · ")}` : "  CLEAN — nothing half-baked is hiding.");
}
L("");
