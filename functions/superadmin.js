// Menchmark Firebase rebuild — Step 5 superadmin-tool internals.
// Design record: docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md
//
// Pure-ish helpers (db passed in explicitly, same pattern as classWriter.js)
// so they're directly testable against the Firestore emulator without going
// through a Cloud Function's onCall()/trigger wrapper — see
// activitySummary.test.js.

const { FieldValue } = require("firebase-admin/firestore");

// ---- activitySummary ----
// "who's stuck" telemetry for admin.html's activity overview. Populated by
// two triggers (a write inside index.js's redeemCode, and the two Firestore
// triggers index.js wires to onClassContentWrite/onClassCreated below) —
// never client-writable (firestore.rules: activitySummary allow write: if
// false).

async function touchActivitySummary(db, uid, patch) {
  await db.collection("activitySummary").doc(uid).set({ ...patch, uid }, { merge: true });
}

// Stamps both accounts/{uid}.lastActive (so exportEmails can read it off a
// single flat accounts scan, per the design doc's "not a join against
// activitySummary" instruction) and activitySummary/{uid} (the admin.html
// overview's data source). `isNew` seeds `invitedAt` once, at account
// creation, and is never touched again.
async function stampSignIn(db, uid, account, isNew) {
  const now = FieldValue.serverTimestamp();
  const summaryPatch = {
    name: account.displayName || null,
    email: account.email || null,
    schoolId: account.schoolId || null,
    role: account.role,
    lastActive: now,
    lastSignIn: now,
  };
  if (isNew) summaryPatch.invitedAt = now;
  await Promise.all([
    db.collection("accounts").doc(uid).set({ lastActive: now }, { merge: true }),
    touchActivitySummary(db, uid, summaryPatch),
  ]);
}

// Trigger 2 (design doc): any owned-data write signals a live human, scan
// volume itself is noise. One extra read (the parent class doc, for
// ownerId) per write — cheap, matches the design doc's own "cheap even at
// hundreds of rows" reasoning about the overview read, applied here to the
// write side instead.
async function bumpActivityForClassWrite(db, classId) {
  const classSnap = await db.collection("classes").doc(classId).get();
  if (!classSnap.exists) return;
  const ownerId = classSnap.data().ownerId;
  if (!ownerId) return;
  const now = FieldValue.serverTimestamp();
  await touchActivitySummary(db, ownerId, { lastActive: now, lastWrite: now });
}

// classCount increments on class create only — firestore.rules sets
// `allow delete: if false` on classes/{classId} (archive, not delete, per
// docs/Firebase_DataModel_Design_Proposal.md), so a decrement trigger would
// be dead code; the design doc's "create or delete" is satisfied by "create
// only" for that reason.
async function bumpActivityForNewClass(db, ownerId) {
  await touchActivitySummary(db, ownerId, {
    classCount: FieldValue.increment(1),
    lastActive: FieldValue.serverTimestamp(),
  });
}

// ---- audit log ----
// Step 5's own collection, separate from step 2's existing viewAsLog — kept
// apart rather than folding viewAs() into it too, so this doesn't touch
// already-shipped step 2 code; admin.html can read both if a single
// combined view is ever wanted.

async function logAudit(db, event, uid, meta) {
  await db.collection("auditLog").add({
    event,
    uid,
    meta: meta || {},
    ts: FieldValue.serverTimestamp(),
  });
}

// ---- CSV ----

function csvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = {
  touchActivitySummary,
  stampSignIn,
  bumpActivityForClassWrite,
  bumpActivityForNewClass,
  logAudit,
  csvField,
};
