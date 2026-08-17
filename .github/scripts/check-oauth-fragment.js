// Sign-in's OAuth-fragment parser (docs/Firebase_SignIn_UI_Design_Proposal.md
// §2) — the exact edge-case-prone shape that already produced a real bug once
// in this codebase (step 4's routeParse() silently swallowing a missing
// classId segment). Same pattern here: extract and run the EXACT function
// from app.html under Node, no second copy to drift out of sync.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("app.html", "utf8");
const startMarker = "/* OAUTH_FRAGMENT_PARSE_START";
const endMarker = "/* OAUTH_FRAGMENT_PARSE_END */";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("Could not find OAUTH_FRAGMENT_PARSE markers in app.html — did the sign-in engine move or get removed?");
  process.exit(1);
}
const blockStart = html.indexOf("*/", start) + 2;
const code = html.slice(blockStart, end);

// URLSearchParams is a Node global in the main context, but a fresh vm
// sandbox starts empty — without this, every call below would hit the
// function's own try/catch (ReferenceError -> null) and every single
// assertion would silently "pass" as null, masking real failures. (This is
// exactly what happened on the first run of this file.)
const sandbox = { URLSearchParams };
vm.createContext(sandbox);
vm.runInContext(code + "\nthis.parseOAuthFragment = parseOAuthFragment;", sandbox);
const { parseOAuthFragment } = sandbox;

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

check("null/undefined hash -> null", parseOAuthFragment(null), null);
check("empty string hash -> null", parseOAuthFragment(""), null);
check("bare '#' -> null", parseOAuthFragment("#"), null);
check("a route hash (step 4's own shape) -> null, never mistaken for OAuth", parseOAuthFragment("#/c/local/scan/scan"), null);
check("garbage hash with neither id_token nor error -> null", parseOAuthFragment("#foo=bar&baz=qux"), null);

check(
  "successful redirect: id_token + state",
  parseOAuthFragment("#id_token=abc.def.ghi&state=xyz123"),
  { idToken: "abc.def.ghi", state: "xyz123", error: null, errorDescription: null }
);
check(
  "successful redirect, no leading '#' (defensive — should still parse)",
  parseOAuthFragment("id_token=abc.def.ghi&state=xyz123"),
  { idToken: "abc.def.ghi", state: "xyz123", error: null, errorDescription: null }
);
check(
  "successful redirect with no state (state defaults to empty string, not null)",
  parseOAuthFragment("#id_token=abc.def.ghi"),
  { idToken: "abc.def.ghi", state: "", error: null, errorDescription: null }
);
check(
  "user declined consent: error + error_description, no id_token",
  parseOAuthFragment("#error=access_denied&error_description=User+cancelled&state=xyz123"),
  { idToken: null, state: "xyz123", error: "access_denied", errorDescription: "User cancelled" }
);
check(
  "id_token containing URL-unsafe characters round-trips (real JWTs use base64url, but be defensive)",
  parseOAuthFragment("#id_token=" + encodeURIComponent("a.b+c/d=") + "&state=s1"),
  { idToken: "a.b+c/d=", state: "s1", error: null, errorDescription: null }
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
