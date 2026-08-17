// Step 7's Drive OAuth-fragment parser (docs/Firebase_Step7_Fragile_Storage_
// Warning_Design_Proposal.md, "Tier-2 event") — same edge-case-prone shape as
// the sign-in flow's own parseOAuthFragment() (check-oauth-fragment.js), and
// specifically the part that has to get the disambiguation right: a bare
// error redirect (#error=...&state=drive.xyz, no access_token at all) must
// still be recognized as a Drive response, not silently mistaken for a
// sign-in error by the parser that runs right after this one in app.html.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("app.html", "utf8");
const startMarker = "/* DRIVE_OAUTH_FRAGMENT_PARSE_START";
const endMarker = "/* DRIVE_OAUTH_FRAGMENT_PARSE_END */";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("Could not find DRIVE_OAUTH_FRAGMENT_PARSE markers in app.html — did the Drive backup engine move or get removed?");
  process.exit(1);
}
const blockStart = html.indexOf("*/", start) + 2;
const code = html.slice(blockStart, end);

// URLSearchParams is a Node global in the main context, but a fresh vm
// sandbox starts empty — without this every call would hit the function's
// own try/catch (ReferenceError -> null) and every assertion would silently
// "pass" as null, masking real failures (check-oauth-fragment.js hit this
// exact bug on its first run).
const sandbox = { URLSearchParams };
vm.createContext(sandbox);
vm.runInContext(code + "\nthis.parseDriveOAuthFragment = parseDriveOAuthFragment;", sandbox);
const { parseDriveOAuthFragment } = sandbox;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ok   - ${name}`);
  } else {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(`         expected ${e}`);
    console.error(`         got      ${a}`);
  }
}

check("null/undefined hash -> null", parseDriveOAuthFragment(null), null);
check("empty string hash -> null", parseDriveOAuthFragment(""), null);
check("bare '#' -> null", parseDriveOAuthFragment("#"), null);
check("a route hash (step 4's own shape) -> null", parseDriveOAuthFragment("#/c/local/scan/scan"), null);
check(
  "a sign-in OAuth response (id_token, non-drive state) -> null, never mistaken for a Drive response",
  parseDriveOAuthFragment("#id_token=abc.def.ghi&state=xyz123"),
  null
);

check(
  "successful Drive redirect: access_token + drive-prefixed state",
  parseDriveOAuthFragment("#access_token=ya29.abc&expires_in=3599&scope=" + encodeURIComponent("https://www.googleapis.com/auth/drive.file") + "&state=drive.nonce123"),
  { accessToken: "ya29.abc", expiresIn: 3599, scope: "https://www.googleapis.com/auth/drive.file", state: "drive.nonce123", error: null, errorDescription: null }
);
check(
  "Drive consent declined: error + drive-prefixed state, NO access_token at all — the exact ambiguity check-oauth-fragment.js's parser can't resolve on its own",
  parseDriveOAuthFragment("#error=access_denied&error_description=User+cancelled&state=drive.nonce123"),
  { accessToken: null, expiresIn: 0, scope: "", state: "drive.nonce123", error: "access_denied", errorDescription: "User cancelled" }
);
check(
  "error redirect with a NON-drive state -> null (this is the sign-in flow's error, not Drive's)",
  parseDriveOAuthFragment("#error=access_denied&state=xyz123"),
  null
);
check(
  "missing state entirely -> null (state is the only disambiguator; no state, no Drive claim)",
  parseDriveOAuthFragment("#access_token=ya29.abc&expires_in=3599"),
  null
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
