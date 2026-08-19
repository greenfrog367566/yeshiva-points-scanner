// Step 5 verification harness for admin.html's three onCall functions
// (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md, "Access
// boundary" + "Email export scope") plus redeemCode's new activitySummary
// integration (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md,
// "activitySummary: what populates it").
//
// Same convention as provisionRebbi.test.js: calls the real exported Cloud
// Functions via onCall()'s .run({data, auth}) against the Firestore + Auth
// emulators — no mocks.
//
// Run via: npm run test:functions
const { checkAccess, logAdminEvent, exportEmails, redeemCode } = require("./index.js");
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

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

async function assertThrows(promise, codeSubstring) {
  try {
    await promise;
  } catch (e) {
    // HttpsError's own .message is the human-readable string ("Sign in
    // required."), not the machine code ("unauthenticated") — check both,
    // same as provisionRebbi.test.js's existing threw.code||threw.message
    // pattern, so a check like "unauthenticated" matches the code even
    // though it never appears in the message text.
    const haystack = String((e.code || "") + " " + (e.message || e)).toLowerCase();
    if (codeSubstring && !haystack.includes(codeSubstring.toLowerCase())) {
      throw new Error(`expected error containing "${codeSubstring}", got: ${e.code || ""} ${e.message || e}`);
    }
    return;
  }
  throw new Error("expected a throw, but the call succeeded");
}

async function seed() {
  await db.collection("accounts").doc("aa_super1").set({ role: "superadmin", schoolId: null, email: "super@example.com" });
  await db.collection("accounts").doc("aa_rebbi1").set({ role: "rebbi", schoolId: "school1", email: "rebbi1@example.com" });
}

async function main() {
  await seed();

  await check("checkAccess: superadmin -> ok:true, nothing logged", async () => {
    const before = (await db.collection("auditLog").where("event", "==", "unauthorizedAccessAttempt").where("uid", "==", "aa_super1").get()).size;
    const res = await checkAccess.run({ data: {}, auth: { uid: "aa_super1", token: {} } });
    assert(res.ok === true, "expected ok:true for a superadmin caller");
    const after = (await db.collection("auditLog").where("event", "==", "unauthorizedAccessAttempt").where("uid", "==", "aa_super1").get()).size;
    assert(after === before, "expected no failed-authorization log entry for a legitimate superadmin");
  });

  await check("checkAccess: non-superadmin -> throws permission-denied AND logs the attempt", async () => {
    await assertThrows(
      checkAccess.run({ data: {}, auth: { uid: "aa_rebbi1", token: { email: "rebbi1@example.com" } } }),
      "superadmin"
    );
    const snap = await db.collection("auditLog").where("event", "==", "unauthorizedAccessAttempt").where("uid", "==", "aa_rebbi1").get();
    assert(snap.size >= 1, "expected the failed attempt to be logged even though the call itself failed");
  });

  await check("checkAccess: unauthenticated -> throws unauthenticated", async () => {
    await assertThrows(checkAccess.run({ data: {}, auth: null }), "unauthenticated");
  });

  await check("logAdminEvent: superadmin logs an event with meta", async () => {
    const res = await logAdminEvent.run({
      data: { event: "activityLoad", meta: { rowCount: 12 } },
      auth: { uid: "aa_super1", token: {} },
    });
    assert(res.ok === true, "expected ok:true");
    const snap = await db.collection("auditLog").where("event", "==", "activityLoad").where("uid", "==", "aa_super1").get();
    assert(snap.size >= 1, "expected the event to be logged");
    assert(snap.docs[snap.docs.length - 1].data().meta.rowCount === 12, "expected meta.rowCount to round-trip");
  });

  await check("logAdminEvent: non-superadmin -> throws permission-denied", async () => {
    await assertThrows(
      logAdminEvent.run({ data: { event: "activityLoad" }, auth: { uid: "aa_rebbi1", token: {} } }),
      "superadmin"
    );
  });

  await check("logAdminEvent: missing event field -> throws invalid-argument", async () => {
    await assertThrows(
      logAdminEvent.run({ data: {}, auth: { uid: "aa_super1", token: {} } }),
      "event is required"
    );
  });

  await check("exportEmails: superadmin gets a CSV with a header row and one row per account", async () => {
    const res = await exportEmails.run({ data: {}, auth: { uid: "aa_super1", token: {} } });
    const lines = res.csv.split("\n");
    assert(lines[0] === "name,email,school,role,lastActive", "expected the exact 5-column header");
    assert(res.rowCount >= 2, "expected at least the two seeded accounts");
    assert(res.csv.includes("rebbi1@example.com"), "expected the rebbi's email to appear in the export");
  });

  await check("exportEmails: non-superadmin -> throws permission-denied", async () => {
    await assertThrows(exportEmails.run({ data: {}, auth: { uid: "aa_rebbi1", token: {} } }), "superadmin");
  });

  await check("exportEmails: logs the export with a row count", async () => {
    await exportEmails.run({ data: {}, auth: { uid: "aa_super1", token: {} } });
    const snap = await db.collection("auditLog").where("event", "==", "emailExport").where("uid", "==", "aa_super1").get();
    assert(snap.size >= 1, "expected an emailExport audit entry");
    assert(typeof snap.docs[snap.docs.length - 1].data().meta.rowCount === "number", "expected meta.rowCount to be a number");
  });

  await check("redeemCode: a returning sign-in stamps activitySummary without changing the returned account", async () => {
    const first = await redeemCode.run({ data: {}, auth: { uid: "aa_signin1", token: { email: "s1@example.com", name: "Sign In One" } } });
    const second = await redeemCode.run({ data: {}, auth: { uid: "aa_signin1", token: { email: "s1@example.com", name: "Sign In One" } } });
    assert(first.role === second.role && first.schoolId === second.schoolId, "expected the same account shape on both calls");
    const summary = (await db.collection("activitySummary").doc("aa_signin1").get()).data();
    assert(summary.email === "s1@example.com", "expected activitySummary to be seeded from the real sign-in");
    assert(summary.lastSignIn != null, "expected lastSignIn to be stamped");
  });

  await check("redeemCode backfill: an existing schoolId:null account can connect to a school afterward", async () => {
    await db.collection("codes").doc("AA_BACKFILL1").set({ type: "school", schoolId: "aa_school1", maxUses: 5, usedBy: [], revoked: false });
    const before = await redeemCode.run({ data: {}, auth: { uid: "aa_backfill1", token: { email: "bf1@example.com", name: "Backfill One" } } });
    assert(before.schoolId === null, "expected the fresh account to start tier-2 (schoolId:null)");
    const after = await redeemCode.run({ data: { code: "AA_BACKFILL1" }, auth: { uid: "aa_backfill1", token: { email: "bf1@example.com", name: "Backfill One" } } });
    assert(after.schoolId === "aa_school1", "expected the backfill to apply the code's schoolId");
    const doc = (await db.collection("accounts").doc("aa_backfill1").get()).data();
    assert(doc.schoolId === "aa_school1", "expected the change to actually persist, not just be returned");
    const code = (await db.collection("codes").doc("AA_BACKFILL1").get()).data();
    assert((code.usedBy || []).includes("aa_backfill1"), "expected the code's usedBy to record this uid");
  });

  await check("redeemCode backfill: an account already connected to a school refuses a second code (already-exists)", async () => {
    await db.collection("codes").doc("AA_BACKFILL2").set({ type: "school", schoolId: "aa_school2", maxUses: 5, usedBy: [], revoked: false });
    await redeemCode.run({ data: { code: "AA_BACKFILL2" }, auth: { uid: "aa_backfill2", token: { email: "bf2@example.com", name: "Backfill Two" } } });
    await assertThrows(
      redeemCode.run({ data: { code: "AA_BACKFILL2" }, auth: { uid: "aa_backfill2", token: { email: "bf2@example.com", name: "Backfill Two" } } }),
      "already-exists"
    );
  });

  await check("redeemCode backfill: a non-school code is rejected (invalid-argument), never silently no-op'd", async () => {
    await db.collection("codes").doc("AA_BACKFILL3").set({ type: "beta", maxUses: 5, usedBy: [], revoked: false });
    await redeemCode.run({ data: {}, auth: { uid: "aa_backfill3", token: { email: "bf3@example.com", name: "Backfill Three" } } });
    await assertThrows(
      redeemCode.run({ data: { code: "AA_BACKFILL3" }, auth: { uid: "aa_backfill3", token: { email: "bf3@example.com", name: "Backfill Three" } } }),
      "invalid-argument"
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
