// Cuts a release: bumps app.html's APP_VERSION, version.json, and renames
// CHANGELOG.md's "## [Unreleased]" heading to a dated version heading (with
// a fresh empty Unreleased above it) — the three files check-version-sync.js
// requires to agree, updated together in one step.
//
// This exists because that three-file edit is exactly the kind of toil that
// silently lapsed for a month (0.9.0, 2026-07-18, was still the live number
// while many features' worth of merges had already shipped past it). A
// human still decides WHEN to cut a release and WHAT the new number is —
// this script only removes the "which files do I have to remember to touch"
// friction, on purpose: CI does not run this automatically or push to main
// on its own, because that would mean giving an automated job write access
// to a branch this repo's ruleset otherwise lets nobody bypass.
//
// Usage: node scripts/bump-version.js 0.10.0
//   Then review the diff, update CHANGELOG's fresh [Unreleased]/new heading
//   text if needed, and commit as part of a normal PR like any other change.
const fs = require("fs");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump-version.js X.Y.Z");
  process.exit(1);
}

const today = process.env.BUMP_VERSION_DATE || new Date().toISOString().slice(0, 10);

// app.html
const appPath = "app.html";
let app = fs.readFileSync(appPath, "utf8");
const appVersionRe = /var APP_VERSION\s*=\s*"[^"]+"/;
if (!appVersionRe.test(app)) {
  console.error("Couldn't find `var APP_VERSION = \"...\"` in app.html");
  process.exit(1);
}
app = app.replace(appVersionRe, 'var APP_VERSION = "' + version + '"');
fs.writeFileSync(appPath, app);

// version.json
const versionJsonPath = "version.json";
const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
versionJson.version = version;
versionJson.released = today;
fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2) + "\n");

// CHANGELOG.md — rename [Unreleased] to the dated heading, add a fresh
// empty Unreleased above it. Leaves the existing entries under the new
// heading exactly as written; nothing else is touched.
const changelogPath = "CHANGELOG.md";
let changelog = fs.readFileSync(changelogPath, "utf8");
const unreleasedRe = /^## \[Unreleased\]\s*$/m;
if (!unreleasedRe.test(changelog)) {
  console.error("Couldn't find `## [Unreleased]` in CHANGELOG.md");
  process.exit(1);
}
changelog = changelog.replace(
  unreleasedRe,
  "## [Unreleased]\n\n## [" + version + "] — " + today
);
fs.writeFileSync(changelogPath, changelog);

console.log("Bumped to " + version + " (" + today + ") in app.html, version.json, CHANGELOG.md.");
console.log("Review the diff, then commit as part of a normal PR.");
