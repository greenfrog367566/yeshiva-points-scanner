// app.html's own comment above APP_VERSION says it plainly: "the three are
// compared against each other and mean nothing apart." This is that
// comparison, enforced — APP_VERSION (app.html), version.json's "version",
// and CHANGELOG.md's newest dated release heading must all agree. Catches
// the drift class that let the update-check banner (docs/CLAUDE.md's
// "alert banner") go silently stale for a month: app.html and version.json
// matched each other the whole time, so nothing ever caught that neither had
// moved past the version the beta cohort onboarded on, even as many releases
// worth of features shipped to main underneath them.
//
// This is a pure verification gate — it never writes anything. Bumping is
// scripts/bump-version.js, run by hand when a maintainer decides to cut a
// release; see that file's header for why that's a human decision and not
// something CI does on every merge.
const fs = require("fs");

function fail(msg) {
  console.log("MISMATCH — " + msg);
  process.exitCode = 1;
}

const appHtml = fs.readFileSync("app.html", "utf8");
const appVersionMatch = appHtml.match(/var APP_VERSION\s*=\s*"([^"]+)"/);
if (!appVersionMatch) fail("couldn't find `var APP_VERSION = \"...\"` in app.html");
const appVersion = appVersionMatch && appVersionMatch[1];

const versionJson = JSON.parse(fs.readFileSync("version.json", "utf8"));
const jsonVersion = versionJson.version;
if (typeof jsonVersion !== "string") fail("version.json has no string \"version\" field");

const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
const headingMatch = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m);
if (!headingMatch) fail("couldn't find a dated `## [x.y.z]` release heading in CHANGELOG.md");
const changelogVersion = headingMatch && headingMatch[1];

console.log("app.html APP_VERSION : " + appVersion);
console.log("version.json version : " + jsonVersion);
console.log("CHANGELOG.md newest  : " + changelogVersion);

if (appVersion && jsonVersion && appVersion !== jsonVersion) {
  fail("app.html (" + appVersion + ") and version.json (" + jsonVersion + ") disagree");
}
if (appVersion && changelogVersion && appVersion !== changelogVersion) {
  fail("app.html (" + appVersion + ") and CHANGELOG.md's newest release heading (" + changelogVersion + ") disagree — did you cut a release without running scripts/bump-version.js, or vice versa?");
}

if (!process.exitCode) console.log("IN SYNC");
