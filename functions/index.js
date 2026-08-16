// Menchmark Firebase rebuild — Step 2 Cloud Functions.
// Design record: docs/Firebase_Step2_Auth_Rules_Design_Proposal.md
//
// accounts/{uid} has `allow write: if false` in firestore.rules — these
// three callables are the ONLY way that document (or a codes.usedBy
// redemption) ever gets written. Nothing here trusts a client-supplied
// schoolId or role; every value that matters is derived server-side from
// the caller's own existing account or from the codes collection.

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ region: "us-central1" });

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function getAccount(uid) {
  const snap = await db.collection("accounts").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/**
 * First-sign-in bootstrap for both Path A and Path B
 * (docs/Firebase_Step2_Auth_Rules_Design_Proposal.md, "Sign-in flows").
 * Idempotent: a retry against an account that already exists just returns
 * it, so a client can call this unconditionally after Firebase Auth
 * completes rather than tracking "is this the first sign-in" itself.
 *
 * No code -> tier-2-shaped account (schoolId: null). A "beta" code lands in
 * the exact same place, per docs/Firebase_DataModel_Design_Proposal.md's
 * signup-code mechanics: "A blank code and a beta PIN land in the exact
 * same place — never a free-text school name field."
 */
exports.redeemCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;

  const existing = await getAccount(uid);
  if (existing) return existing;

  const accountRef = db.collection("accounts").doc(uid);
  const email = request.auth.token.email || null;
  const displayName = request.auth.token.name || null;
  const code = ((request.data && request.data.code) || "").trim();

  if (!code) {
    const account = {
      role: "rebbi",
      schoolId: null,
      email,
      displayName,
      createdAt: FieldValue.serverTimestamp(),
    };
    await accountRef.set(account);
    return account;
  }

  const codeRef = db.collection("codes").doc(code);

  return db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) {
      throw new HttpsError("not-found", "That code isn't recognized.");
    }
    const c = codeSnap.data();
    if (c.revoked) {
      throw new HttpsError("failed-precondition", "That code has been revoked.");
    }
    const usedBy = c.usedBy || [];
    const alreadyRedeemedByMe = usedBy.includes(uid);
    if (!alreadyRedeemedByMe) {
      if (typeof c.maxUses === "number" && usedBy.length >= c.maxUses) {
        throw new HttpsError("resource-exhausted", "That code has reached its use limit.");
      }
      tx.update(codeRef, { usedBy: FieldValue.arrayUnion(uid) });
    }

    const account = {
      role: "rebbi",
      schoolId: c.type === "school" ? c.schoolId : null,
      email,
      displayName,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(accountRef, account);
    return account;
  });
});

/**
 * Admin self-provisioning (docs/Firebase_Step2_Auth_Rules_Design_Proposal.md,
 * "Admin self-provisioning"). The request's schoolId is never read — the
 * function pulls it from the CALLER's own account doc, which is the entire
 * guarantee: an admin can only ever mint accounts inside his own school
 * because there is no parameter through which he could name a different one.
 *
 * Idempotent by construction: newUid_1 is deterministic (matches the
 * locked write-id pattern), so retrying a partially-failed call creates
 * nothing twice.
 */
exports.provisionRebbi = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a school admin can provision a rebbi.");
  }

  const email = request.data && request.data.email;
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "An email is required.");
  }
  const schoolId = caller.schoolId;

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (e) {
    userRecord = await auth.createUser({ email });
  }
  const newUid = userRecord.uid;

  const accountRef = db.collection("accounts").doc(newUid);
  const classRef = db.collection("classes").doc(`${newUid}_1`);

  await db.runTransaction(async (tx) => {
    const [accountSnap, classSnap] = await Promise.all([tx.get(accountRef), tx.get(classRef)]);

    if (!accountSnap.exists) {
      tx.set(accountRef, {
        role: "rebbi",
        schoolId,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (!classSnap.exists) {
      tx.set(classRef, {
        ownerId: newUid,
        schoolId,
        name: "",
        sectionOf: null,
        archived: false,
        sharedWithAdmin: false,
        lastWriteDevice: "admin:" + request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  // Requires menchmark.app (or whatever APP_SIGNIN_URL points at) to be
  // listed under Firebase Auth -> Settings -> Authorized domains, or the
  // email link will fail to complete sign-in.
  const actionCodeSettings = {
    url: process.env.APP_SIGNIN_URL || "https://menchmark.app/app.html",
    handleCodeInApp: true,
  };
  const signInLink = await auth.generateSignInWithEmailLink(email, actionCodeSettings);

  return { uid: newUid, signInLink };
});

/**
 * Mints a short-lived "view as" custom token for a superadmin
 * (docs/Firebase_Step2_Auth_Rules_Design_Proposal.md, "'View as this
 * rebbi' mechanism"). The token's uid stays the superadmin's own — viewAs
 * rides as an extra claim, never an identity swap. firestore.rules reads
 * request.auth.token.viewAs/.viewAsExp and grants read only, and only
 * before viewAsExp.
 *
 * OPEN QUESTION, flagged for whoever wires this into step 5's admin.html:
 * additionalClaims passed to createCustomToken() are guaranteed on the
 * FIRST ID token exchanged from this custom token. Whether a background
 * token refresh (the JS SDK does this roughly hourly) still carries viewAs
 * is not verified here — confirm against the emulator or a throwaway
 * account before relying on "sign in with this token" as a 30-minute
 * session. Either answer is survivable (drop-on-refresh fails safe; the
 * firestore.rules expiry check is the actual backstop either way), but it
 * changes what the "Exit view-as" button needs to do.
 */
exports.viewAs = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Superadmin only.");
  }

  const targetUid = request.data && request.data.targetUid;
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  const viewAsExp = Date.now() + 30 * 60 * 1000;
  const token = await auth.createCustomToken(request.auth.uid, {
    viewAs: targetUid,
    viewAsExp,
  });

  await db.collection("viewAsLog").add({
    superadminUid: request.auth.uid,
    targetUid,
    ts: FieldValue.serverTimestamp(),
  });

  return { token, viewAsExp };
});
