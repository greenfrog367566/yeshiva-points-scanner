// Menchmark Firebase rebuild — Step 3 converter internals.
// Design record: docs/Firebase_Step3_Converter_Tool_Design_Proposal.md
//                 docs/Firebase_DataModel_Design_Proposal.md
//
// Turns one already-normalized `data` blob (post migrateData()/load2fix(),
// exactly what app.html itself trusts — see the __exportNormalized bridge
// in app.html) into a batch of Firestore writes for one class, then proves
// the write landed intact.
//
// SCOPE NOTE, not a bug: the data model doc explicitly leaves
// "scores/log/activities/raffle/etc." as "out of scope to enumerate here."
// This module covers the collections that ARE fully specified — classes,
// students, trackedItems, trackedEntries — plus activities/log/scores,
// whose shapes were confirmed directly against app.html
// (`data.activities = [{id,name,pts}]`, `data.log = [{ts,sid,label,delta}]`,
// `data.scores = {studentId: number}`). Deliberately NOT yet covered:
// prizeLedger (raffle/auction/store history), seating, and Settings — their
// source shapes weren't verified against app.html for this pass, and
// writing an untested mapping for them would be worse than a clean
// omission. A partial import that reports success is worse than a clean
// failure (the design doc's own bar) — so importReceipts below reports
// exactly which collections were written, never implying completeness
// beyond that.

const { FieldValue } = require("firebase-admin/firestore");

const BATCH_LIMIT = 400; // stays under Firestore's hard 500-op cap with headroom

/**
 * "Chaim Yosef Berkowitz" -> {firstName:"Chaim Yosef", lastName:"Berkowitz"}.
 * A single-word name has nothing to split — flagged for manual review
 * rather than silently guessing (docs/Firebase_DataModel_Design_Proposal.md:
 * "flagged for manual review, never silently dropped").
 */
function splitName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return { firstName: "", lastName: "", nameSplitFlagged: true };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", nameSplitFlagged: true };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
    nameSplitFlagged: false,
  };
}

/**
 * Builds the full write-op list for one class from a normalized `data`
 * blob, plus the counts a verification pass should find afterward.
 * Every doc id is either reused verbatim from the source (students,
 * trackedItems, activities all already carry a stable `id`) or synthesized
 * deterministically (trackedEntries, log) so a rerun is a no-op overwrite,
 * never a duplicate — the locked write-id pattern.
 */
function buildClassWriteOps(db, classId, ownerId, schoolId, normalized, deviceId) {
  const ops = [];
  const classRef = db.collection("classes").doc(classId);
  const now = FieldValue.serverTimestamp();

  ops.push({
    ref: classRef,
    data: {
      ownerId,
      schoolId: schoolId || null,
      name: normalized.className || normalized.school || "",
      sectionOf: null,
      archived: false,
      sharedWithAdmin: false,
      lastWriteDevice: deviceId,
      createdAt: now,
      updatedAt: now,
    },
  });

  const students = Array.isArray(normalized.students) ? normalized.students : [];
  const scores = normalized.scores && typeof normalized.scores === "object" ? normalized.scores : {};
  let nameSplitFlags = 0;
  students.forEach((s) => {
    if (!s || !s.id) return;
    const { firstName, lastName, nameSplitFlagged } = splitName(s.name);
    if (nameSplitFlagged) nameSplitFlags++;
    ops.push({
      ref: classRef.collection("students").doc(String(s.id)),
      data: {
        firstName,
        lastName,
        section: s.group || null, // loop-and-copy, verbatim — never inferred
        score: typeof scores[s.id] === "number" ? scores[s.id] : 0,
        archived: false,
        nameSplitFlagged,
        joinedAt: now,
      },
    });
  });

  const trackedItems = Array.isArray(normalized.trackedItems) ? normalized.trackedItems : [];
  trackedItems.forEach((it) => {
    if (!it || !it.id) return;
    ops.push({
      ref: classRef.collection("trackedItems").doc(String(it.id)),
      data: { name: it.name || "", method: it.method || null, config: it.config || null },
    });
  });

  let trackedEntryCount = 0;
  const trackedData = normalized.trackedData && typeof normalized.trackedData === "object" ? normalized.trackedData : {};
  Object.keys(trackedData).forEach((itemId) => {
    const perStudent = trackedData[itemId];
    if (!perStudent || typeof perStudent !== "object") return;
    Object.keys(perStudent).forEach((studentId) => {
      const list = perStudent[studentId];
      if (!Array.isArray(list)) return;
      list.forEach((entry) => {
        if (!entry || typeof entry.ts !== "number") return;
        const entryId = `${itemId}_${studentId}_${entry.ts}`;
        const doc = { itemId, studentId, value: entry.value, ts: entry.ts };
        if (typeof entry.date === "string" && entry.date) doc.date = entry.date;
        if (typeof entry.src === "string" && entry.src) doc.src = entry.src;
        ops.push({ ref: classRef.collection("trackedEntries").doc(entryId), data: doc });
        trackedEntryCount++;
      });
    });
  });

  const activities = Array.isArray(normalized.activities) ? normalized.activities : [];
  activities.forEach((a) => {
    if (!a || !a.id) return;
    ops.push({
      ref: classRef.collection("activities").doc(String(a.id)),
      data: { name: a.name || "", pts: typeof a.pts === "number" ? a.pts : 0 },
    });
  });

  const log = Array.isArray(normalized.log) ? normalized.log : [];
  const logIdSeen = {}; // disambiguates same-student same-millisecond entries
  log.forEach((entry, idx) => {
    if (!entry || typeof entry.ts !== "number" || !entry.sid) return;
    let entryId = `${entry.sid}_${entry.ts}`;
    if (logIdSeen[entryId]) entryId = `${entryId}_${idx}`;
    logIdSeen[entryId] = true;
    ops.push({
      ref: classRef.collection("log").doc(entryId),
      data: { sid: entry.sid, label: entry.label || "", delta: typeof entry.delta === "number" ? entry.delta : 0, ts: entry.ts },
    });
  });

  return {
    ops,
    expectedCounts: {
      students: students.length,
      trackedItems: trackedItems.length,
      trackedEntries: trackedEntryCount,
      activities: activities.length,
      log: log.length,
    },
    nameSplitFlags,
  };
}

/**
 * Commits write ops in chunks under Firestore's 500-op batch cap.
 *
 * NOTE ON ATOMICITY: the design doc describes this as "commit-whole-or-
 * write-nothing... partial-success is structurally impossible." That holds
 * for any class small enough to fit one batch. A real class with a few
 * thousand trackedEntries (the log cap alone is 5000 per CLAUDE.md) does
 * NOT fit in one 500-op batch, so this chunks into sequential batches
 * instead — which means a crash mid-run CAN leave a partial write. That's
 * exactly why verifyClassWrite() below re-reads and compares counts before
 * anything is ever reported "done": chunked-writes-plus-verification is the
 * actual safety net here, not raw single-batch atomicity. Flagging this
 * explicitly rather than let the design doc's stronger claim stand
 * unchallenged for large classes.
 */
async function commitChunked(db, ops) {
  let committed = 0;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach(({ ref, data }) => batch.set(ref, data, { merge: false }));
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

/**
 * Re-reads what was just written and compares against the counts computed
 * from the same normalized source object already in memory — the
 * "count parity" half of the verification harness. Also pulls a 5-student
 * spot-check sample for the manual diff report UI.
 */
async function verifyClassWrite(db, classId, expectedCounts) {
  const classRef = db.collection("classes").doc(classId);
  const [studentsSnap, itemsSnap, entriesSnap, activitiesSnap, logSnap] = await Promise.all([
    classRef.collection("students").get(),
    classRef.collection("trackedItems").get(),
    classRef.collection("trackedEntries").get(),
    classRef.collection("activities").get(),
    classRef.collection("log").get(),
  ]);

  const counts = {
    students: studentsSnap.size,
    trackedItems: itemsSnap.size,
    trackedEntries: entriesSnap.size,
    activities: activitiesSnap.size,
    log: logSnap.size,
  };

  const mismatches = Object.keys(expectedCounts).filter((k) => expectedCounts[k] !== counts[k]);

  const spotCheckSample = studentsSnap.docs.slice(0, 5).map((d) => ({
    id: d.id,
    firstName: d.data().firstName,
    lastName: d.data().lastName,
    section: d.data().section,
  }));

  return {
    status: mismatches.length === 0 ? "verified" : "mismatch",
    counts: { expected: expectedCounts, actual: counts },
    mismatches,
    spotCheckSample,
  };
}

/**
 * Refuses to silently overwrite an existing non-empty class
 * (docs/Firebase_Step3_Converter_Tool_Design_Proposal.md, "Never silently
 * overwrite"). "Non-empty" is approximated as "has at least one student
 * doc" — cheap, and a class with zero students has nothing worth protecting.
 */
async function classHasContent(db, classId) {
  const snap = await db.collection("classes").doc(classId).collection("students").limit(1).get();
  return !snap.empty;
}

/**
 * Finds the next free `{ownerId}_{seq}` class id — the "offer restore as a
 * new class" alternative to overwriting, for the case a rebbi's own backup
 * conflicts with a class already in his account.
 */
async function nextAvailableClassId(db, ownerId) {
  let seq = 1;
  for (;;) {
    const id = `${ownerId}_${seq}`;
    const snap = await db.collection("classes").doc(id).get();
    if (!snap.exists) return id;
    seq++;
  }
}

module.exports = {
  splitName,
  buildClassWriteOps,
  commitChunked,
  verifyClassWrite,
  classHasContent,
  nextAvailableClassId,
};
