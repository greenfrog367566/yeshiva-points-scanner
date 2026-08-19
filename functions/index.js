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
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const {
  buildClassWriteOps,
  commitChunked,
  verifyClassWrite,
  classHasContent,
  nextAvailableClassId,
} = require("./classWriter");
const {
  stampSignIn,
  bumpActivityForClassWrite,
  bumpActivityForNewClass,
  logAudit,
  csvField,
} = require("./superadmin");

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
 *
 * Also handles backfill: called again with a code on an EXISTING
 * schoolId:null account (the header account menu's "Connect to school"),
 * this applies a "school" code after the fact instead of creating a second
 * account. Refuses outright (already-exists) if the account already has a
 * schoolId — connecting to a school is a one-way door here, never a silent
 * reassignment.
 */
exports.redeemCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;

  const existing = await getAccount(uid);
  if (existing) {
    const backfillCode = ((request.data && request.data.code) || "").trim();
    // Backfill: an account that skipped the code screen (or was created
    // before this existed) can connect to a school afterward — the header
    // account menu's "Connect to school" action. Never a silent reassignment
    // of an account that already belongs to one; that would be exactly the
    // kind of overwrite this codebase's data-safety rules exist to prevent.
    if (backfillCode && existing.schoolId == null) {
      const codeRef = db.collection("codes").doc(backfillCode);
      const accountRef = db.collection("accounts").doc(uid);
      existing.schoolId = await db.runTransaction(async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists) throw new HttpsError("not-found", "That code isn't recognized.");
        const c = codeSnap.data();
        if (c.revoked) throw new HttpsError("failed-precondition", "That code has been revoked.");
        if (c.type !== "school") throw new HttpsError("invalid-argument", "That code doesn't connect to a school.");
        const usedBy = c.usedBy || [];
        if (!usedBy.includes(uid)) {
          if (typeof c.maxUses === "number" && usedBy.length >= c.maxUses) {
            throw new HttpsError("resource-exhausted", "That code has reached its use limit.");
          }
          tx.update(codeRef, { usedBy: FieldValue.arrayUnion(uid) });
        }
        tx.update(accountRef, { schoolId: c.schoolId });
        return c.schoolId;
      });
    } else if (backfillCode && existing.schoolId != null) {
      throw new HttpsError("already-exists", "Your account is already connected to a school.");
    }
    // Step 5 (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md,
    // "activitySummary: what populates it", trigger 1 — "every successful
    // sign-in updates lastActive and lastSignIn"): the client already calls
    // redeemCode() unconditionally on every sign-in (see this function's own
    // doc comment above), which makes it the natural home for that stamp —
    // no separate client-invoked function needed.
    await stampSignIn(db, uid, existing, false);
    return existing;
  }

  const accountRef = db.collection("accounts").doc(uid);
  const email = request.auth.token.email || null;
  const displayName = request.auth.token.name || null;
  const code = ((request.data && request.data.code) || "").trim();

  let account;
  if (!code) {
    account = {
      role: "rebbi",
      schoolId: null,
      email,
      displayName,
      createdAt: FieldValue.serverTimestamp(),
    };
    await accountRef.set(account);
  } else {
    const codeRef = db.collection("codes").doc(code);

    account = await db.runTransaction(async (tx) => {
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

      const newAccount = {
        role: "rebbi",
        schoolId: c.type === "school" ? c.schoolId : null,
        email,
        displayName,
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.set(accountRef, newAccount);
      return newAccount;
    });
  }

  // stampSignIn runs OUTSIDE the transaction above (when there was one) —
  // activitySummary isn't part of that transaction's invariant (over-
  // redemption of a code), it's a separate best-effort telemetry write.
  await stampSignIn(db, uid, account, true);
  return account;
});

// Shared by the admin-driven roster branch and self-serve's roster mode —
// one row->normalized-blob mapping, not two to keep in sync.
function rosterRowsToNormalized(className, rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    className: className || "",
    students: list.map((r, i) => ({ id: (r && r.id) || `roster_${i}`, name: (r && r.name) || "", group: (r && r.group) || null })),
  };
}

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
    if (mode !== "backup" && mode !== "roster") {
      throw new HttpsError("invalid-argument", "Self-serve is only supported for mode: 'backup' or 'roster'.");
    }
    let normalized;
    if (mode === "backup") {
      if (!payload.normalized || typeof payload.normalized !== "object") {
        throw new HttpsError("invalid-argument", "A normalized backup payload is required.");
      }
      normalized = payload.normalized;
    } else {
      // mode:"roster", self:true — the sign-in flow's first-run screen
      // (docs/Firebase_SignIn_UI_Design_Proposal.md §3.5), flagged there as
      // a small necessary extension to this function rather than assumed.
      // Same roster-entry component, same row->normalized mapping the
      // admin-driven roster branch below uses.
      normalized = rosterRowsToNormalized(payload.className, payload.students);
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

    return writeClassAndVerify(classId, uid, caller.schoolId, normalized, "self:" + uid.slice(0, 8) + ":" + deviceId);
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
    const normalized = rosterRowsToNormalized(payload.className, rows);
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

// ---- step 5: activitySummary Firestore triggers ----
// (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md, "activitySummary:
// what populates it"). Never client-invoked — these fire on the real write
// events, which is what makes activitySummary a summary rather than
// something admin.html has to compute itself on every load.

exports.onClassContentWrite = onDocumentWritten(
  "classes/{classId}/{collectionId}/{docId}",
  async (event) => {
    await bumpActivityForClassWrite(db, event.params.classId);
  }
);

exports.onClassCreated = onDocumentCreated("classes/{classId}", async (event) => {
  const data = event.data.data();
  await bumpActivityForNewClass(db, data.ownerId);
});

// ---- step 5: admin.html access control + audit log ----
// (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md, "Access
// boundary"). auditLog is step 5's own collection, separate from step 2's
// existing viewAsLog — kept apart rather than folding viewAs() into it too,
// so this doesn't touch already-shipped step 2 code; admin.html can read
// both if a single combined view is ever wanted.

/**
 * Called once by admin.html right after auth resolves, before the page
 * decides whether to render anything privileged. This is what makes a
 * curious non-superadmin's page load visible to Berel even if the client-
 * side gate never lets the UI mount — the design doc's "even a no-op
 * checkAccess ping" failed-authorization logging.
 */
exports.checkAccess = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "superadmin") {
    await logAudit(db, "unauthorizedAccessAttempt", request.auth.uid, { email: request.auth.token.email || null });
    throw new HttpsError("permission-denied", "Superadmin only.");
  }
  return { ok: true };
});

/**
 * Minimal generic logger for admin.html's own privileged reads that aren't
 * already a Cloud Function call — today, just the activity-overview load
 * (a plain client-side Firestore read, gated by firestore.rules, not a
 * function) — so it still lands in the same audit trail as viewAs mints and
 * the export below, per the design doc's "one consistent privileged-read
 * log, not a special case."
 */
exports.logAdminEvent = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Superadmin only.");
  }
  const event = request.data && request.data.event;
  if (!event || typeof event !== "string") {
    throw new HttpsError("invalid-argument", "event is required.");
  }
  const meta = (request.data && request.data.meta && typeof request.data.meta === "object") ? request.data.meta : {};
  await logAudit(db, event, request.auth.uid, meta);
  return { ok: true };
});

/**
 * Single server-side CSV export (docs/Firebase_Step5_Superadmin_Tools_Design_Proposal.md,
 * "Email export scope") — "export the list, don't build a mailer." Reads
 * `accounts` only, a flat single-collection scan (lastActive lives directly
 * on the account doc via stampSignIn() above, so this never joins against
 * activitySummary). No filters, no preview, no scheduling.
 */
exports.exportEmails = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const caller = await getAccount(request.auth.uid);
  if (!caller || caller.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Superadmin only.");
  }

  const snap = await db.collection("accounts").get();
  const rows = [["name", "email", "school", "role", "lastActive"].map(csvField).join(",")];
  snap.forEach((doc) => {
    const d = doc.data();
    const lastActive = d.lastActive && typeof d.lastActive.toDate === "function" ? d.lastActive.toDate().toISOString() : "";
    rows.push([d.displayName || "", d.email || "", d.schoolId || "", d.role || "", lastActive].map(csvField).join(","));
  });
  const csv = rows.join("\n");

  await logAudit(db, "emailExport", request.auth.uid, { rowCount: snap.size });
  return { csv, rowCount: snap.size };
});
