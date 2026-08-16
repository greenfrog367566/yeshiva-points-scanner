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
const {
  buildClassWriteOps,
  commitChunked,
  verifyClassWrite,
  classHasContent,
  nextAvailableClassId,
} = require("./classWriter");

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

async function mintOrFindUid(email) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return userRecord.uid;
  } catch (e) {
    const userRecord = await auth.createUser({ email });
    return userRecord.uid;
  }
}

async function ensureAccount(uid, schoolId, email) {
  const accountRef = db.collection("accounts").doc(uid);
  const snap = await accountRef.get();
  if (!snap.exists) {
    await accountRef.set({
      role: "rebbi",
      schoolId,
      email,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function issueSignInLink(email) {
  // Requires menchmark.app (or whatever APP_SIGNIN_URL points at) to be
  // listed under Firebase Auth -> Settings -> Authorized domains, or the
  // email link will fail to complete sign-in.
  const actionCodeSettings = {
    url: process.env.APP_SIGNIN_URL || "https://menchmark.app/app.html",
    handleCodeInApp: true,
  };
  return auth.generateSignInWithEmailLink(email, actionCodeSettings);
}

/**
 * Writes one class's content (empty starter, roster-only, or a full
 * normalized backup blob) and runs the verification harness before
 * returning — see functions/classWriter.js and
 * docs/Firebase_Step3_Converter_Tool_Design_Proposal.md.
 *
 * `normalized` may be null (admin-invite: empty starter class) or a
 * migrateData()/load2fix()-normalized `data` blob (roster/backup modes —
 * for roster mode, `normalized` is synthesized from the roster rows below
 * rather than coming from a real backup file).
 */
async function writeClassAndVerify(classId, ownerId, schoolId, normalized, deviceId) {
  const { ops, expectedCounts, nameSplitFlags } = buildClassWriteOps(
    db, classId, ownerId, schoolId, normalized || {}, deviceId
  );
  await commitChunked(db, ops);
  const receipt = { ...(await verifyClassWrite(db, classId, expectedCounts)), nameSplitFlags };

  const runId = db.collection("_").doc().id; // cheap way to mint a random id
  await db.collection("classes").doc(classId).collection("importReceipts").doc(runId).set({
    ...receipt,
    ts: FieldValue.serverTimestamp(),
  });

  return { classId, runId, receipt };
}

/**
 * Provisions a rebbi's account and class, or restores a rebbi's own backup,
 * depending on `mode`. One function, not four, per the design doc's "extend
 * provisionRebbi, don't fork it" — every route that ends in a new
 * accounts/{uid} doc or a class write funnels through here, which is what
 * satisfies accounts' `allow write: if false` by construction.
 *
 * data.mode:
 *   "admin-invite" (default) — unchanged from step 2: empty starter class,
 *     admin-driven.
 *   "roster"  — admin-driven, payload.email + payload.students:[{name,group}].
 *   "backup"  — admin-driven (payload.email + payload.normalized), OR
 *               self-serve when data.self===true (target is the caller,
 *               no role check — "a rebbi restoring his own backup isn't
 *               provisioning anyone").
 * data.force        — required to overwrite a class that already has content.
 * data.asNewClass   — self-serve only: write to the next free {uid}_{seq}
 *                      instead of refusing/overwriting.
 * data.deviceId     — stamped onto lastWriteDevice; falls back to "unknown".
 */
exports.provisionRebbi = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const payload = request.data || {};
  const mode = payload.mode || "admin-invite";
  const deviceId = typeof payload.deviceId === "string" && payload.deviceId ? payload.deviceId : "unknown";

  // ---- self-serve restore: caller acts on his own account only ----
  if (payload.self === true) {
    if (mode !== "backup") {
      throw new HttpsError("invalid-argument", "Self-serve is only supported for mode: 'backup'.");
    }
    if (!payload.normalized || typeof payload.normalized !== "object") {
      throw new HttpsError("invalid-argument", "A normalized backup payload is required.");
    }
    const uid = request.auth.uid;
    const caller = await getAccount(uid);
    if (!caller) throw new HttpsError("failed-precondition", "Sign in and complete account setup first.");

    let classId = `${uid}_1`;
    if (payload.asNewClass === true) {
      classId = await nextAvailableClassId(db, uid);
    } else if (await classHasContent(db, classId)) {
      if (payload.force !== true) {
        throw new HttpsError(
          "already-exists",
          "This account already has a class with data. Pass force:true to overwrite, or asNewClass:true to restore alongside it."
        );
      }
    }

    return writeClassAndVerify(classId, uid, caller.schoolId, payload.normalized, "self:" + uid.slice(0, 8) + ":" + deviceId);
  }

  // ---- admin-driven: admin-invite | roster | backup-for-someone-else ----
  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a school admin can provision a rebbi.");
  }
  const schoolId = caller.schoolId;
  const deviceTag = "admin:" + request.auth.uid.slice(0, 8) + ":" + deviceId;

  if (mode === "admin-invite") {
    const email = payload.email;
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "An email is required.");
    }
    const newUid = await mintOrFindUid(email);
    await ensureAccount(newUid, schoolId, email);
    const classId = `${newUid}_1`;
    if (!(await classHasContent(db, classId))) {
      await writeClassAndVerify(classId, newUid, schoolId, null, deviceTag);
    }
    const signInLink = await issueSignInLink(email);
    return { uid: newUid, classId, signInLink };
  }

  if (mode === "roster") {
    const email = payload.email;
    const rows = Array.isArray(payload.students) ? payload.students : [];
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "An email is required.");
    }
    const newUid = await mintOrFindUid(email);
    await ensureAccount(newUid, schoolId, email);
    const classId = `${newUid}_1`;
    if (!payload.force && (await classHasContent(db, classId))) {
      throw new HttpsError("already-exists", "That rebbi already has a class with data. Pass force:true to overwrite.");
    }
    const normalized = {
      className: payload.className || "",
      students: rows.map((r, i) => ({ id: r.id || `roster_${i}`, name: r.name || "", group: r.group || null })),
    };
    const { runId, receipt } = await writeClassAndVerify(classId, newUid, schoolId, normalized, deviceTag);
    const signInLink = await issueSignInLink(email);
    return { uid: newUid, classId, runId, receipt, signInLink };
  }

  if (mode === "backup") {
    const email = payload.email;
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "An email is required.");
    }
    if (!payload.normalized || typeof payload.normalized !== "object") {
      throw new HttpsError("invalid-argument", "A normalized backup payload is required.");
    }
    const newUid = await mintOrFindUid(email);
    await ensureAccount(newUid, schoolId, email);
    const classId = `${newUid}_1`;
    if (!payload.force && (await classHasContent(db, classId))) {
      throw new HttpsError("already-exists", "That rebbi already has a class with data. Pass force:true to overwrite.");
    }
    const { runId, receipt } = await writeClassAndVerify(classId, newUid, schoolId, payload.normalized, deviceTag);
    const signInLink = await issueSignInLink(email);
    return { uid: newUid, classId, runId, receipt, signInLink };
  }

  throw new HttpsError("invalid-argument", `Unknown mode: ${mode}`);
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
