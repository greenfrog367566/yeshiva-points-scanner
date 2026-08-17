// Step 5 verification harness for functions/superadmin.js's pure-ish
// helpers (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md,
// "activitySummary: what populates it" + "Access boundary").
//
// Same pattern as provisionRebbi.test.js: exercises the real functions
// directly against the Firestore emulator (db passed in explicitly, same
// as classWriter.js), no mocks, no functions emulator needed since these
// aren't onCall()-wrapped.
//
// Run via: npm run test:functions
//   (== firebase emulators:exec --only firestore,auth "node functions/provisionRebbi.test.js && node functions/superadmin.test.js")

const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
// provisionRebbi.test.js requires ./index.js (which calls initializeApp()
// itself). This file may run standalone, so guard against duplicate-app.
try { initializeApp(); } catch (e) { /* already initialized */ }
const db = getFirestore();
const {
  touchActivitySummary,
  stampSignIn,
  bumpActivityForClassWrite,
  bumpActivityForNewClass,
  logAudit,
  csvField,
} = require("./superadmin");

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   - ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(`         ${String((e && e.message) || e)}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

async function main() {
  await check("stampSignIn seeds activitySummary + accounts.lastActive on first sign-in", async () => {
    const account = { role: "rebbi", schoolId: "school1", email: "r1@example.com", displayName: "Rebbi One" };
    await stampSignIn(db, "sa_user1", account, true);

    const summary = (await db.collection("activitySummary").doc("sa_user1").get()).data();
    assert(summary.name === "Rebbi One", "expected name to be seeded");
    assert(summary.email === "r1@example.com", "expected email to be seeded");
    assert(summary.schoolId === "school1", "expected schoolId to be seeded");
    assert(summary.role === "rebbi", "expected role to be seeded");
    assert(summary.invitedAt != null, "expected invitedAt to be stamped on first sign-in");
    assert(summary.lastActive != null, "expected lastActive to be stamped");
    assert(summary.lastSignIn != null, "expected lastSignIn to be stamped");

    const acct = (await db.collection("accounts").doc("sa_user1").get()).data();
    assert(acct.lastActive != null, "expected accounts/{uid}.lastActive to be stamped (exportEmails reads this directly)");
  });

  await check("stampSignIn on a returning sign-in does NOT re-stamp invitedAt", async () => {
    const account = { role: "rebbi", schoolId: "school1", email: "r1@example.com", displayName: "Rebbi One" };
    const before = (await db.collection("activitySummary").doc("sa_user1").get()).data();
    await stampSignIn(db, "sa_user1", account, false);
    const after = (await db.collection("activitySummary").doc("sa_user1").get()).data();
    assert(
      before.invitedAt.isEqual(after.invitedAt),
      "expected invitedAt to stay exactly as first stamped, not move on a later sign-in"
    );
  });

  await check("bumpActivityForNewClass increments classCount from 0", async () => {
    await bumpActivityForNewClass(db, "sa_user2");
    const summary = (await db.collection("activitySummary").doc("sa_user2").get()).data();
    assert(summary.classCount === 1, "expected classCount 1 after first class");
    await bumpActivityForNewClass(db, "sa_user2");
    const summary2 = (await db.collection("activitySummary").doc("sa_user2").get()).data();
    assert(summary2.classCount === 2, "expected classCount 2 after a second class");
  });

  await check("bumpActivityForClassWrite resolves ownerId from the parent class doc and stamps lastWrite", async () => {
    await db.collection("classes").doc("sa_user3_1").set({ ownerId: "sa_user3", schoolId: "school1" });
    await bumpActivityForClassWrite(db, "sa_user3_1");
    const summary = (await db.collection("activitySummary").doc("sa_user3").get()).data();
    assert(summary.lastWrite != null, "expected lastWrite to be stamped");
    assert(summary.lastActive != null, "expected lastActive to be stamped");
  });

  await check("bumpActivityForClassWrite is a no-op for an unknown classId (no crash, no doc created)", async () => {
    await bumpActivityForClassWrite(db, "does_not_exist_1");
    const summary = await db.collection("activitySummary").doc("does_not_exist").get();
    assert(!summary.exists, "expected no activitySummary doc to be created for an unresolvable classId");
  });

  await check("touchActivitySummary merges rather than overwrites", async () => {
    await touchActivitySummary(db, "sa_user4", { role: "rebbi" });
    await touchActivitySummary(db, "sa_user4", { schoolId: "school9" });
    const summary = (await db.collection("activitySummary").doc("sa_user4").get()).data();
    assert(summary.role === "rebbi", "expected the first merge's field to survive the second merge");
    assert(summary.schoolId === "school9", "expected the second merge's field to also be present");
  });

  await check("logAudit writes a queryable event doc", async () => {
    await logAudit(db, "testEvent", "sa_user5", { rowCount: 3 });
    const snap = await db.collection("auditLog").where("event", "==", "testEvent").where("uid", "==", "sa_user5").get();
    assert(snap.size === 1, "expected exactly one matching audit log entry");
    assert(snap.docs[0].data().meta.rowCount === 3, "expected meta to round-trip");
  });

  await check("csvField quotes values containing commas, quotes, or newlines", () => {
    assert(csvField("plain") === "plain", "plain value should pass through unquoted");
    assert(csvField("a,b") === '"a,b"', "comma should trigger quoting");
    assert(csvField('a"b') === '"a""b"', 'embedded quote should be doubled and the field quoted');
    assert(csvField("a\nb") === '"a\nb"', "embedded newline should trigger quoting");
    assert(csvField(null) === "", "null should become an empty field, not the string 'null'");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
