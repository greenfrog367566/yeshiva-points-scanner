/* Menchmark's own Firebase project config — not vendored third-party code,
 * so it lives at the repo root rather than under vendor/firebase/.
 *
 * Safe to commit: Firebase client config identifies the project and
 * authorizes nothing on its own (see CLAUDE.md rule 3's amendment and
 * docs/Firebase_Rebuild_Scope.md, open question 1's "Security" note) — all
 * real gating is firestore.rules, enforced server-side. Loaded by any
 * tier-1/superadmin surface that needs it (tools/admin-convert.html today;
 * app.html's own tier-1 shell once step 4 builds it).
 */
window.MENCHMARK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_Kpr2rWioS1v_lTCMBT2_7r4eLc1sCAU",
  authDomain: "menchmark-backend.firebaseapp.com",
  projectId: "menchmark-backend",
  storageBucket: "menchmark-backend.firebasestorage.app",
  messagingSenderId: "566788715634",
  appId: "1:566788715634:web:017e116d23f6272e0cfeeb",
  measurementId: "G-7VWHZGX4RB"
};

// OAuth 2.0 Web client ID for the SDK-free Google sign-in redirect
// (docs/Firebase_SignIn_UI_Design_Proposal.md §2) — a public identifier, not
// a secret; safe alongside the config above for the same reason. Used to
// build the accounts.google.com authorization URL directly, before any
// Firebase SDK is ever loaded.
window.MENCHMARK_GOOGLE_CLIENT_ID =
  "566788715634-8vsvti13qhtr67ac64vhq57mfmuijek5.apps.googleusercontent.com";
