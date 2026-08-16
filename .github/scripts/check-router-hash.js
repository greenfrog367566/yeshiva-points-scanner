// Step 4 PR1's unit test (docs/Firebase_Step4_Routing_Design_Proposal.md,
// "PR1 — Router module, inert": "Unit-testable via a test-migration.html-
// style harness: feed hash strings, assert parsed {classId,group,tab}
// round-trips using the persisted internal keys.")
//
// Unlike test-migration.html's migrateData()/load2fix(), which need a
// second copy because they depend on the full app context, routeParse()/
// routeBuild() are deliberately dependency-free — so this extracts and runs
// the EXACT block from app.html under Node instead of maintaining a second
// copy that could drift out of sync.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("app.html", "utf8");
const startMarker = "/* ROUTE_HASH_FUNCTIONS_START";
const endMarker = "/* ROUTE_HASH_FUNCTIONS_END */";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("Could not find ROUTE_HASH_FUNCTIONS markers in app.html — did PR1's router block move or get removed?");
  process.exit(1);
}
// Skip past the marker comment's closing "*/" before the real code starts.
const blockStart = html.indexOf("*/", start) + 2;
const code = html.slice(blockStart, end);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code + "\nthis.routeParse = routeParse; this.routeBuild = routeBuild;", sandbox);
const { routeParse, routeBuild } = sandbox;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ok   - ${name}`);
  } else {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(`         expected ${e}`);
    console.error(`         got      ${a}`);
  }
}

// ---- round-trip: build then parse gets the same route back ----
[
  { classId: "abc123_1", group: "scan", tab: "scan" },
  { classId: "abc123_1", group: "scan", tab: "history" },
  { classId: "abc123_1", group: "learn", tab: "learn-text" },
  { classId: "abc123_1", group: "manage", tab: "gradebook", subtab: "class" },
  { classId: "local", group: "standings", tab: "contest" },
].forEach((route) => {
  const hash = routeBuild(route);
  const back = routeParse(hash);
  check(`round-trip: ${JSON.stringify(route)}`, back, {
    classId: route.classId,
    group: route.group,
    tab: route.tab,
    subtab: route.subtab || null,
  });
});

// ---- parse: malformed / partial hashes ----
check("parse empty string -> null", routeParse(""), null);
check("parse bare '#' -> null", routeParse("#"), null);
check("parse missing tab -> tab:null", routeParse("#/c/x/scan"), { classId: "x", group: "scan", tab: null, subtab: null });
check("parse wrong prefix -> null", routeParse("#/notc/x/scan/scan"), null);
check("parse missing classId -> null", routeParse("#/c//scan/scan"), null);
check("parse no leading '#' still works", routeParse("/c/x/scan/scan"), { classId: "x", group: "scan", tab: "scan", subtab: null });
check("parse null input -> null", routeParse(null), null);
check("parse trailing slash ignored", routeParse("#/c/x/scan/scan/"), { classId: "x", group: "scan", tab: "scan", subtab: null });

// ---- parse: URL-encoded classId round-trips ----
check(
  "classId needing encoding round-trips",
  routeParse(routeBuild({ classId: "weird id/slash", group: "scan", tab: "scan" })),
  { classId: "weird id/slash", group: "scan", tab: "scan", subtab: null }
);

// ---- build: missing required fields refuses rather than emitting a broken hash ----
check("build with no classId -> null", routeBuild({ group: "scan", tab: "scan" }), null);
check("build with no tab -> null", routeBuild({ classId: "x", group: "scan" }), null);
check("build with no group -> null", routeBuild({ classId: "x", tab: "scan" }), null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
