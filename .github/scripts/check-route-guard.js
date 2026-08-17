// Step 4 PR4's unit test (docs/Firebase_Step4_Routing_Design_Proposal.md,
// "Tier-aware route guard"): the guard is dependency-free by design — it
// takes an already-looked-up class-index entry and an already-resolved auth
// uid as plain arguments rather than reaching into CLASS_INDEX/data itself —
// so, like PR1's routeParse()/routeBuild() (check-router-hash.js), this
// extracts and runs the EXACT block from app.html under Node instead of
// maintaining a second copy that could drift out of sync.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("app.html", "utf8");
const startMarker = "/* ROUTE_GUARD_START";
const endMarker = "/* ROUTE_GUARD_END */";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("Could not find ROUTE_GUARD markers in app.html — did PR4's guard block move or get removed?");
  process.exit(1);
}
// Skip past the marker comment's closing "*/" before the real code starts.
const blockStart = html.indexOf("*/", start) + 2;
const code = html.slice(blockStart, end);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code + "\nthis.routeGuardClass = routeGuardClass;", sandbox);
const { routeGuardClass } = sandbox;

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

// ---- rule 1: unknown classId (no index entry at all) fails closed ----
check("unknown class -> fail closed", routeGuardClass(null, null), { ok: false, reason: "unknown-class" });
check("unknown class -> fail closed even if authUid given", routeGuardClass(null, "u1"), { ok: false, reason: "unknown-class" });

// ---- rule 2: schoolId null is tier-2 — always allowed, no auth check ----
check(
  "tier-2 class (schoolId:null), no auth -> ok",
  routeGuardClass({ schoolId: null, ownerId: null }, null),
  { ok: true }
);
check(
  "tier-2 class (schoolId:null), any authUid -> ok (auth irrelevant to tier-2)",
  routeGuardClass({ schoolId: null, ownerId: null }, "someone"),
  { ok: true }
);

// ---- rule 3: schoolId set is tier-1 — signed-out fails closed ----
check(
  "tier-1 class, signed out -> fail closed",
  routeGuardClass({ schoolId: "school1", ownerId: "owner1" }, null),
  { ok: false, reason: "signed-out" }
);

// ---- rule 4: tier-1, authUid matches ownerId -> ok ----
check(
  "tier-1 class, authUid === ownerId -> ok",
  routeGuardClass({ schoolId: "school1", ownerId: "owner1" }, "owner1"),
  { ok: true }
);

// ---- rule 5: tier-1, authUid is an admin-share -> ok ----
check(
  "tier-1 class, authUid in adminShareUids -> ok",
  routeGuardClass({ schoolId: "school1", ownerId: "owner1", adminShareUids: ["admin1", "admin2"] }, "admin2"),
  { ok: true }
);

// ---- rule 6: tier-1, authUid is neither owner nor an admin-share -> forbidden ----
check(
  "tier-1 class, authUid is a stranger -> forbidden",
  routeGuardClass({ schoolId: "school1", ownerId: "owner1" }, "stranger"),
  { ok: false, reason: "forbidden" }
);
check(
  "tier-1 class, authUid not in adminShareUids -> forbidden",
  routeGuardClass({ schoolId: "school1", ownerId: "owner1", adminShareUids: ["admin1"] }, "stranger"),
  { ok: false, reason: "forbidden" }
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
