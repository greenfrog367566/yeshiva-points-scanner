// Step 3 verification harness for provisionRebbi's mode dispatch
// (docs/Firebase_Step3_Converter_Tool_Design_Proposal.md, "Verification
// harness implementation" + "Staged rollout plan" Stage 1/2).
//
// Runs against the Firestore + Auth emulators — no mocks. Calls the actual
// exported Cloud Function via onCall()'s .run({data, auth}), which invokes
// the real handler with a fabricated auth context, so this exercises the
// exact code path production traffic hits.
//
// Run via: npm run test:functions
//   (== firebase emulators:exec --only firestore,auth "node functions/provisionRebbi.test.js")
//   GCLOUD_PROJECT / FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
//   must already be set — see package.json's script.

// index.js calls initializeApp() itself on require — do that first, then
// reuse its already-initialized default app rather than calling
// initializeApp() a second time (which throws duplicate-app).
const { provisionRebbi } = require("./index.js");
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

async function seed() {
  await db.collection("accounts").doc("admin1").set({ role: "admin", schoolId: "school1" });
  await db.collection("accounts").doc("rebbiSelf").set({ role: "rebbi", schoolId: null });
}

const SMALL_NORMALIZED = {
  className: "Test Class",
  school: "Test School",
  students: [
    { id: "s1", name: "Chaim Berkowitz", group: "A" },
    { id: "s2", name: "Dovid", group: "A" }, // single word — should flag nameSplitFlagged
  ],
  trackedItems: [{ id: "ti1", name: "Homework", method: "boolean", config: null }],
  trackedData: {
    ti1: {
      s1: [{ value: true, ts: 1000, date: "2026-08-01" }],
      s2: [
        { value: true, ts: 2000, date: "2026-08-01" },
        { value: false, ts: 3000, date: "2026-08-02" },
      ],
    },
  },
  activities: [{ id: "a1", name: "On time", pts: 1 }],
  log: [
    { ts: 5000, sid: "s1", label: "On time", delta: 1 },
    { ts: 6000, sid: "s2", label: "On time", delta: 1 },
  ],
  scores: { s1: 3, s2: 1 },
};

async function main() {
  await seed();

  await check("Self-serve backup restore writes and verifies", async () => {
    const res = await provisionRebbi.run({
      data: { mode: "backup", self: true, normalized: SMALL_NORMALIZED, deviceId: "test-device" },
      auth: { uid: "rebbiSelf", token: {} },
    });
    assert(res.receipt.status === "verified", "expected status verified, got " + res.receipt.status);
    assert(res.receipt.counts.actual.students === 2, "expected 2 students");
    assert(res.receipt.counts.actual.trackedEntries === 3, "expected 3 tracked entries");
    assert(res.receipt.counts.actual.activities === 1, "expected 1 activity");
    assert(res.receipt.counts.actual.log === 2, "expected 2 log entries");
    assert(res.receipt.nameSplitFlags === 1, "expected 1 name-split flag (Dovid, single word)");
  });

  await check("Self-serve rerun without force refuses (overwrite gate)", async () => {
    let threw = null;
    try {
      await provisionRebbi.run({
        data: { mode: "backup", self: true, normalized: SMALL_NORMALIZED, deviceId: "test-device" },
        auth: { uid: "rebbiSelf", token: {} },
      });
    } catch (e) {
      threw = e;
    }
    assert(threw, "expected an already-exists error, got none");
    assert(String(threw.code || threw.message).indexOf("already-exists") >= 0 || String(threw).indexOf("already has a class") >= 0,
      "expected already-exists style error, got: " + threw);
  });

  await check("Self-serve rerun WITH force overwrites and stays idempotent (no duplicate docs)", async () => {
    const before = await db.collection("classes").doc("rebbiSelf_1").collection("students").get();
    const res = await provisionRebbi.run({
      data: { mode: "backup", self: true, force: true, normalized: SMALL_NORMALIZED, deviceId: "test-device" },
      auth: { uid: "rebbiSelf", token: {} },
    });
    const after = await db.collection("classes").doc("rebbiSelf_1").collection("students").get();
    assert(res.receipt.status === "verified", "expected verified on rerun");
    assert(before.size === after.size, `expected same doc count on idempotent rerun, got ${before.size} -> ${after.size}`);
  });

  await check("Self-serve asNewClass writes alongside the existing class, not over it", async () => {
    const res = await provisionRebbi.run({
      data: { mode: "backup", self: true, asNewClass: true, normalized: SMALL_NORMALIZED, deviceId: "test-device" },
      auth: { uid: "rebbiSelf", token: {} },
    });
    assert(res.classId === "rebbiSelf_2", `expected rebbiSelf_2, got ${res.classId}`);
    const originalStillThere = await db.collection("classes").doc("rebbiSelf_1").collection("students").get();
    assert(originalStillThere.size === 2, "original class should be untouched");
  });

  await check("Non-admin cannot call admin-driven modes -> permission-denied", async () => {
    let threw = null;
    try {
      await provisionRebbi.run({
        data: { mode: "roster", email: "nope@example.com", students: [] },
        auth: { uid: "rebbiSelf", token: {} },
      });
    } catch (e) {
      threw = e;
    }
    assert(threw, "expected permission-denied, got none");
  });

  await check("Admin roster mode creates account + class from roster rows", async () => {
    const res = await provisionRebbi.run({
      data: {
        mode: "roster",
        email: "newrebbi@example.com",
        className: "New Rebbi's Class",
        students: [
          { name: "Yaakov Klein", group: "B" },
          { name: "Moshe Cohen", group: "B" },
        ],
      },
      auth: { uid: "admin1", token: {} },
    });
    assert(res.receipt.status === "verified", "expected verified");
    assert(res.receipt.counts.actual.students === 2, "expected 2 students from roster");
    assert(typeof res.signInLink === "string" && res.signInLink.length > 0, "expected a sign-in link");
    const accountSnap = await db.collection("accounts").doc(res.uid).get();
    assert(accountSnap.exists && accountSnap.data().schoolId === "school1", "expected new account scoped to admin's schoolId");
  });

  await check("Admin backup mode for someone else writes the full normalized blob", async () => {
    const res = await provisionRebbi.run({
      data: { mode: "backup", email: "existingtester@example.com", normalized: SMALL_NORMALIZED, deviceId: "admin-upload" },
      auth: { uid: "admin1", token: {} },
    });
    assert(res.receipt.status === "verified", "expected verified");
    assert(res.receipt.counts.actual.trackedEntries === 3, "expected 3 tracked entries carried over");
  });

  await check("Admin-invite mode (step 2 behavior) still creates an empty starter class", async () => {
    const res = await provisionRebbi.run({
      data: { mode: "admin-invite", email: "brandnew@example.com" },
      auth: { uid: "admin1", token: {} },
    });
    const studentsSnap = await db.collection("classes").doc(res.classId).collection("students").get();
    assert(studentsSnap.size === 0, "expected an empty starter class");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
