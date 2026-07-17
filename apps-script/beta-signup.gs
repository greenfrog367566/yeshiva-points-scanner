/**
 * ═══════════════════════════════════════════════════════════════════
 * Menchmark Beta Signup — Google Apps Script backend
 * ═══════════════════════════════════════════════════════════════════
 *
 * Receives signups POSTed from beta.html and appends each one as a row
 * in a sheet tab named "Menchmark Beta Signups" (created automatically,
 * with headers, the first time a signup arrives).
 *
 * ── HOW TO DEPLOY ────────────────────────────────────────────────────
 * 1. Create a new Google Sheet (any name — e.g. "Menchmark Beta").
 * 2. In the Sheet: Extensions → Apps Script.
 * 3. Delete the placeholder code and paste this entire file.
 * 4. Click Deploy → New deployment → gear icon → Web app.
 *      - Description:   Menchmark beta signup
 *      - Execute as:    Me
 *      - Who has access: Anyone
 * 5. Click Deploy, authorize when prompted, and copy the Web app URL
 *    (it looks like https://script.google.com/macros/s/AKfycb.../exec).
 * 6. Paste that URL into beta.html — the BETA_SIGNUP_ENDPOINT constant
 *    at the top of its <script> section.
 *
 * To verify it's live, open the Web app URL in a browser — you should
 * see "Menchmark beta signup endpoint is live."
 *
 * ⚠ If you ever CHANGE this code, pasting it here is not enough —
 *   Deploy → Manage deployments → ✎ → Version: New version, then
 *   Deploy. (Same rule as the app's sync script.)
 * ─────────────────────────────────────────────────────────────────────
 */

var SHEET_NAME = "Menchmark Beta Signups";
var HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "School / City",
  "Grade(s)",
  "Class size",
  "Current points system",
  "Smartboard / Projector",
  "Scanner access",
  "Eagerness",
  "How they heard",
  "Anything else"
];

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);

    // Honeypot: bots fill every field, including the hidden "website"
    // one. Report success so the bot can't tell it was rejected, but
    // write nothing.
    if (p.website) return jsonOut({ ok: true });

    // Minimal server-side sanity check (mirror of the form's required
    // fields — a real submission from beta.html always has these).
    if (!p.name || !p.email) return jsonOut({ ok: false, error: "Missing required fields" });

    // Fold the "Other" detail into the heard-from column so the sheet
    // stays at exactly HEADERS.length columns.
    var heard = p.heardFrom || "";
    if (heard === "Other" && p.heardOther) heard = "Other: " + p.heardOther;

    // Serialize concurrent signups — two simultaneous appendRow calls
    // on the same sheet can interleave without the lock.
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(SHEET_NAME);
      if (!sh) {
        sh = ss.insertSheet(SHEET_NAME);
        sh.appendRow(HEADERS);
        sh.setFrozenRows(1);
        sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      }
      sh.appendRow([
        new Date(),
        String(p.name || ""),
        String(p.email || ""),
        String(p.school || ""),
        String(p.grades || ""),
        String(p.classSize || ""),
        String(p.currentSystem || ""),
        String(p.display || ""),
        String(p.scanner || ""),
        String(p.eagerness || ""),
        heard,
        String(p.notes || "")
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// Opening the deployment URL in a browser hits doGet — a quick way to
// confirm the deployment worked before wiring it into beta.html.
function doGet() {
  return ContentService.createTextOutput("Menchmark beta signup endpoint is live.");
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
