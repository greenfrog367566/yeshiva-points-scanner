// Verifies the plain-HTTP callable-function protocol app.html's sign-in
// engine actually uses (docs/Firebase_SignIn_UI_Design_Proposal.md §2) --
// a POST to the Functions emulator's HTTP endpoint with {data:...} and a
// Bearer ID token, NOT onCall()'s .run({data,auth}) test harness used
// elsewhere in this repo, which fabricates request.auth directly and never
// exercises real HTTP auth-header parsing at all. Getting THIS wrong would
// silently break sign-in end-to-end without any other test here catching it.
//
// Run via: npm run test:http-callable
const { getAuth } = require("firebase-admin/auth");
require("./index.js"); // initializeApp() side effect
const auth = getAuth();

const FUNCTIONS_HOST = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const PROJECT_ID = process.env.GCLOUD_PROJECT || "menchmark-rules-test";
const REGION = "us-central1";
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

function functionUrl(name) {
  return `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/${name}`;
}

// Mints a real ID token for a fake user via the Auth emulator: a custom
// token from the Admin SDK, exchanged for an ID token through the
// emulator's own identitytoolkit REST endpoint -- exactly the kind of
// token exchange app.html's real sign-in does against production.
async function mintIdToken(uid) {
  const customToken = await auth.createCustomToken(uid);
  const url = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.idToken;
}

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

async function main() {
  await check("Callable function over raw HTTP with a Bearer ID token succeeds (no-code path)", async () => {
    const idToken = await mintIdToken("httpTestUser1");
    const res = await fetch(functionUrl("redeemCode"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: {} }),
    });
    const json = await res.json();
    assert(res.ok, `expected 200, got ${res.status}: ${JSON.stringify(json)}`);
    assert(json.result && json.result.role === "rebbi", `expected a rebbi account result, got ${JSON.stringify(json)}`);
    assert(json.result.schoolId === null, "expected schoolId:null (no code entered)");
  });

  await check("Callable function over raw HTTP with NO Authorization header fails as unauthenticated", async () => {
    const res = await fetch(functionUrl("redeemCode"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    const json = await res.json();
    assert(!res.ok || json.error, `expected a failure without auth, got: ${JSON.stringify(json)}`);
  });

  await check("Callable function over raw HTTP is idempotent (retry returns the same account)", async () => {
    const idToken = await mintIdToken("httpTestUser2");
    const call = () =>
      fetch(functionUrl("redeemCode"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ data: {} }),
      }).then((r) => r.json());
    const first = await call();
    const second = await call();
    assert(first.result.role === second.result.role, "expected the same account both times");
  });

  await check("Google-credential exchange REST shape (accounts:signInWithIdp) is accepted by the Auth emulator", async () => {
    // The Auth emulator's documented fake-IDP support: postBody's id_token
    // can be a JSON blob (not a real JWT) instead of a genuine Google
    // credential, specifically so this exact request shape — the one
    // app.html's exchangeGoogleIdTokenForFirebase() sends to PRODUCTION —
    // can be verified without a real Google sign-in. Same body, same
    // fields, different host (emulator here, real Google in production).
    const fakeGoogleIdToken = JSON.stringify({
      sub: "fakeGoogleSub123",
      email: "rebbi@example.com",
      email_verified: true,
      name: "Test Rebbi",
    });
    const url = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(fakeGoogleIdToken)}&providerId=google.com`,
        requestUri: "http://localhost/app.html",
        returnSecureToken: true,
      }),
    });
    const json = await res.json();
    assert(res.ok, `expected 200, got ${res.status}: ${JSON.stringify(json)}`);
    assert(typeof json.idToken === "string" && json.idToken.length > 0, "expected a Firebase idToken back");
    assert(typeof json.localId === "string" && json.localId.length > 0, "expected a Firebase uid (localId) back");
    assert(json.email === "rebbi@example.com", `expected email to round-trip, got ${json.email}`);
  });

  await check("Firestore REST read of accounts/{uid} matches firestoreGetAccount()'s expected shape", async () => {
    // app.html reads the account doc via the Firestore REST API directly
    // (never the SDK, at this point in the flow) — a third untested code
    // path alongside the two above. Emulator's REST surface mirrors
    // production's, just at a different host.
    const idToken = await mintIdToken("httpTestUser3");
    await fetch(functionUrl("redeemCode"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: {} }),
    }); // ensures accounts/httpTestUser3 exists to read back

    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
    const url = `http://${firestoreHost}/v1/projects/${PROJECT_ID}/databases/(default)/documents/accounts/httpTestUser3`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const doc = await res.json();
    assert(res.ok, `expected 200, got ${res.status}: ${JSON.stringify(doc)}`);
    assert(doc.fields && doc.fields.role && doc.fields.role.stringValue === "rebbi",
      `expected typed field role.stringValue==="rebbi", got ${JSON.stringify(doc.fields)}`);
    assert("nullValue" in (doc.fields.schoolId || {}), `expected schoolId to be a Firestore null value, got ${JSON.stringify(doc.fields.schoolId)}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
