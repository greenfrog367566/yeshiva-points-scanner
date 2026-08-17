// Firestore security rules test suite — step 2's test-migration.html
// analogue (docs/Firebase_Step2_Auth_Rules_Design_Proposal.md, "Rules
// Verification Harness").
//
// Seeds fixtures directly into the emulator (bypassing rules, as admin),
// then asserts a fixed (actor, target, operation) -> allow/deny matrix.
// The matrix below is transcribed line-for-line from the design doc so a
// reader can compare row-for-row.
//
// Run via: npm run test:rules
//   (== firebase emulators:exec --only firestore "node firestore.rules.test.js")

const fs = require("fs");
const path = require("path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "menchmark-rules-test";

let passed = 0;
let failed = 0;

async function check(name, promise, expect) {
  try {
    if (expect === "allow") {
      await assertSucceeds(promise);
    } else {
      await assertFails(promise);
    }
    passed++;
    console.log(`  ok   - ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(`         ${String(e.message || e).split("\n")[0]}`);
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8085,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.collection("accounts").doc("a").set({ role: "rebbi", schoolId: "school1" });
    await db.collection("accounts").doc("b").set({ role: "rebbi", schoolId: "school1" });
    await db.collection("accounts").doc("admin1").set({ role: "admin", schoolId: "school1" });
    await db.collection("accounts").doc("super1").set({ role: "superadmin", schoolId: null });
    // Not a superadmin — isolates the viewAs claim's read-only grant from
    // the independent isSuperadmin() escape hatch (a real superadmin's own
    // uid would pass isSuperadmin() regardless of any viewAs claim it also
    // carries, which would silently mask what the claim itself does or
    // doesn't grant).
    await db.collection("accounts").doc("viewer").set({ role: "rebbi", schoolId: null });

    // a_1 / b_1: read-only fixtures, never mutated by a later test — every
    // read-path assertion below targets these so test order can't matter.
    await db.collection("classes").doc("a_1").set({
      ownerId: "a", schoolId: "school1", name: "A's Class", sectionOf: null,
      archived: false, sharedWithAdmin: true, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });
    await db.collection("classes").doc("b_1").set({
      ownerId: "b", schoolId: "school1", name: "B's Class", sectionOf: null,
      archived: false, sharedWithAdmin: false, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });
    await db.collection("classes").doc("a_1").collection("students").doc("s1")
      .set({ firstName: "Chaim", lastName: "K" });
    await db.collection("classes").doc("b_1").collection("students").doc("s2")
      .set({ firstName: "Dovid", lastName: "L" });

    // Dedicated docs per mutation test, so one test's write can never change
    // what an earlier- or later-run read test observes.
    await db.collection("classes").doc("a_mut1").set({
      ownerId: "a", schoolId: "school1", name: "A mut1", sectionOf: null,
      archived: false, sharedWithAdmin: true, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });
    await db.collection("classes").doc("b_mut1").set({
      ownerId: "b", schoolId: "school1", name: "B mut1", sectionOf: null,
      archived: false, sharedWithAdmin: false, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });
    await db.collection("classes").doc("a_mut2").set({
      ownerId: "a", schoolId: "school1", name: "A mut2", sectionOf: null,
      archived: false, sharedWithAdmin: false, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });
    await db.collection("classes").doc("b_mut2").set({
      ownerId: "b", schoolId: "school1", name: "B mut2", sectionOf: null,
      archived: false, sharedWithAdmin: false, lastWriteDevice: "seed",
      createdAt: 0, updatedAt: 0,
    });

    await db.collection("codes").doc("SCHOOL1")
      .set({ type: "school", schoolId: "school1", maxUses: 50, usedBy: [], revoked: false });
  });

  const asA = testEnv.authenticatedContext("a").firestore();
  const asB = testEnv.authenticatedContext("b").firestore();
  const asAdmin = testEnv.authenticatedContext("admin1").firestore();
  const asSuper = testEnv.authenticatedContext("super1").firestore();
  const asAnon = testEnv.unauthenticatedContext().firestore();
  const asFreshSignIn = testEnv.authenticatedContext("brandnew").firestore(); // signed in, no accounts doc yet
  const asViewingA = testEnv
    .authenticatedContext("viewer", { viewAs: "a", viewAsExp: Date.now() + 30 * 60 * 1000 })
    .firestore();
  const asExpiredViewingA = testEnv
    .authenticatedContext("viewer", { viewAs: "a", viewAsExp: Date.now() - 1000 })
    .firestore();

  console.log("Firestore rules matrix:");

  await check("A reads own class -> allow", asA.doc("classes/a_1").get(), "allow");
  await check("A reads B's class -> deny (core gating claim)", asB.doc("classes/a_1").get(), "deny");
  await check("A reads B's students subcollection directly -> deny", asA.doc("classes/b_1/students/s2").get(), "deny");
  await check("A writes sharedWithAdmin on own class -> allow", asA.doc("classes/a_mut1").update({ sharedWithAdmin: false }), "allow");
  await check("A writes sharedWithAdmin on B's class -> deny", asA.doc("classes/b_mut1").update({ sharedWithAdmin: true }), "deny");

  await check("Admin reads school class with sharedWithAdmin:false -> deny", asAdmin.doc("classes/b_1").get(), "deny");
  await check("Admin reads school class with sharedWithAdmin:true -> allow", asAdmin.doc("classes/a_1").get(), "allow");
  await check("Admin writes roster/entries/ledger -> deny (field-restricted, not blanket)", asAdmin.doc("classes/a_1/students/s1").update({ firstName: "X" }), "deny");
  await check("Admin writes archived/sharedWithAdmin only -> allow", asAdmin.doc("classes/a_mut2").update({ archived: true, sharedWithAdmin: true }), "allow");
  await check("Admin write adding a third key -> deny", asAdmin.doc("classes/b_mut2").update({ archived: true, sharedWithAdmin: true, name: "Hijacked" }), "deny");

  await check("Superadmin reads any class -> allow", asSuper.doc("classes/b_1").get(), "allow");
  await check("Superadmin writes any class -> allow", asSuper.doc("classes/b_mut2").update({ name: "Fixed by support" }), "allow");

  // Actor here ("viewer") is deliberately NOT a superadmin account — see the
  // fixtures comment above. This isolates what the viewAs claim itself
  // grants from the independent, unconditional isSuperadmin() write access
  // a real superadmin's own uid would otherwise carry regardless of any
  // claim it's holding.
  await check("View-as (unexpired) reads target's class -> allow", asViewingA.doc("classes/a_1").get(), "allow");
  await check("View-as (unexpired) cannot write target's class -> deny", asViewingA.doc("classes/a_1").update({ name: "sneaky" }), "deny");
  await check("View-as (expired) cannot read target's class -> deny", asExpiredViewingA.doc("classes/a_1").get(), "deny");

  // The design doc's rule spec ("read: if request.auth != null") requires
  // sign-in, not literal anonymity — codes are read after Google Sign-In
  // completes but before an accounts doc exists (see "Sign-in flows"),
  // never by a fully unauthenticated client. Test both halves of that.
  await check("Fully unauthenticated read of codes/{code} -> deny", asAnon.doc("codes/SCHOOL1").get(), "deny");
  await check("Signed-in-but-no-account-yet reads codes/{code} -> allow", asFreshSignIn.doc("codes/SCHOOL1").get(), "allow");
  await check("Unauthenticated write of codes/{code} -> deny", asAnon.doc("codes/SCHOOL1").update({ revoked: true }), "deny");
  await check("Client write to codes.usedBy -> deny (Cloud-Function-only)", asA.doc("codes/SCHOOL1").update({ usedBy: ["a"] }), "deny");

  await check("Any client write to accounts -> deny (Cloud-Function-only)", asA.doc("accounts/a").set({ role: "superadmin" }), "deny");
  await check("Even superadmin cannot client-write accounts -> deny", asSuper.doc("accounts/a").set({ role: "superadmin" }), "deny");

  await check("Prize ledger: no admin default-read (private ledger) -> deny", asAdmin.doc("classes/a_1/prizeLedger/x").get(), "deny");
  await check("Prize ledger: owner can read -> allow", asA.doc("classes/a_1/prizeLedger/x").get(), "allow");

  // Step 3 additions (docs/Firebase_Step3_Converter_Tool_Design_Proposal.md)
  await check("Activities: owner can read -> allow", asA.doc("classes/a_1/activities/x").get(), "allow");
  await check("Activities: B cannot read A's -> deny", asB.doc("classes/a_1/activities/x").get(), "deny");
  await check("Activities: admin cannot write directly -> deny", asAdmin.doc("classes/a_1/activities/x").set({ name: "hack" }), "deny");
  await check("Log: owner can read -> allow", asA.doc("classes/a_1/log/x").get(), "allow");
  await check("Log: B cannot read A's -> deny", asB.doc("classes/a_1/log/x").get(), "deny");
  await check("Import receipts: owner can read -> allow", asA.doc("classes/a_1/importReceipts/x").get(), "allow");
  await check("Import receipts: client write -> deny (Cloud-Function-only)", asA.doc("classes/a_1/importReceipts/x").set({ status: "verified" }), "deny");
  await check("Import receipts: even superadmin cannot client-write -> deny", asSuper.doc("classes/a_1/importReceipts/x").set({ status: "verified" }), "deny");

  await testEnv.cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
