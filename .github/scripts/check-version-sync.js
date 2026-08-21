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

// sw.js's CACHE_VERSION joined this gate after 0.10.0 shipped still reading
// the hand-written "v1" it had carried since the PWA landed — the same drift
// class as the three above, lapsed the same way: a convention living in a
// comment that nothing prompts anyone to honour. Worth being exact about what
// a lapse costs, because it is NOT "installed rebbeim run a stale app
// offline" — app.html is network-first and re-cached on every online load. It
// is the cache-first assets (manifest, icons, vendor/firebase/*.js) that stay
// pinned until the cache NAME changes, so a vendored SDK file replaced in
// place would never reach an already-installed rebbi. Unfalsifiable in a
// browser once it happens, and free to check here.
const sw = fs.readFileSync("sw.js", "utf8");
const swMatch = sw.match(/var CACHE_VERSION\s*=\s*"([^"]+)"/);
if (!swMatch) fail("couldn't find `var CACHE_VERSION = \"...\"` in sw.js");
const swVersion = swMatch && swMatch[1];

console.log("app.html APP_VERSION : " + appVersion);
console.log("version.json version : " + jsonVersion);
console.log("CHANGELOG.md newest  : " + changelogVersion);
console.log("sw.js CACHE_VERSION  : " + swVersion);

if (appVersion && jsonVersion && appVersion !== jsonVersion) {
  fail("app.html (" + appVersion + ") and version.json (" + jsonVersion + ") disagree");
}
if (appVersion && changelogVersion && appVersion !== changelogVersion) {
  fail("app.html (" + appVersion + ") and CHANGELOG.md's newest release heading (" + changelogVersion + ") disagree — did you cut a release without running scripts/bump-version.js, or vice versa?");
}
if (appVersion && swVersion && appVersion !== swVersion) {
  fail("app.html (" + appVersion + ") and sw.js's CACHE_VERSION (" + swVersion + ") disagree — scripts/bump-version.js moves both; a hand-edited version number is the usual cause.");
}

if (!process.exitCode) console.log("IN SYNC");
