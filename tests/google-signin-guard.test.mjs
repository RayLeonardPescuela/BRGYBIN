// Regression guard for the startup crash:
//
//   [runtime not ready]: Invariant Violation:
//   TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be
//   found. Verify that a module by this name is registered in the native
//   binary.
//
// `@react-native-google-signin/google-signin` runs `getEnforcing` while its
// module is being evaluated. App.js -> Login.js -> config/google.js makes
// that happen during bundle boot, so requiring the library unconditionally
// on native killed the app before the first screen, in Expo Go (whose binary
// does not contain RNGoogleSignin).
//
// The fix: probe the registry with the NON-throwing `get()` and only require
// the library when the native module is really linked; otherwise surface a
// clear "unavailable" message through signInWithGoogle().
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

const google = readFileSync("config/google.js", "utf8");
// Same source with // comments blanked out, so prose that *mentions* a
// forbidden API does not trip a code-level assertion.
const googleCode = google.replace(/^\s*\/\/.*$/gm, "");
const login = readFileSync("screens/Login.js", "utf8");

// ---- the probe must be the non-throwing one ----
t(
  "probes with TurboModuleRegistry.get (not getEnforcing)",
  /TurboModuleRegistry\.get\(\s*["']RNGoogleSignin["']\s*\)/.test(google)
);
t("does not call getEnforcing itself", !/TurboModuleRegistry\.getEnforcing\(/.test(googleCode));
t(
  "TurboModuleRegistry is imported from react-native",
  /import\s*\{[^}]*\bTurboModuleRegistry\b[^}]*\}\s*from\s*["']react-native["']/.test(google)
);

// ---- the require must come AFTER the probe ----
const probeAt = google.indexOf("TurboModuleRegistry.get(");
const requireAt = google.indexOf('require("@react-native-google-signin/google-signin")');
t("native library is required somewhere", requireAt !== -1);
t("probe happens before the require", probeAt !== -1 && probeAt < requireAt);

// ---- and the require must sit behind the gate, not at module top level ----
const gateAt = google.indexOf("hasNativeModule");
t(
  "require is gated by the probe result",
  gateAt !== -1 && gateAt < requireAt,
  "hasNativeModule index " + gateAt
);
t(
  "gate re-checks web too (web must never require the native lib)",
  /const hasNativeModule =\s*\n?\s*isNative &&/.test(google)
);

// ---- failure must be a message, not a crash ----
t("exports an unavailable-reason helper", google.includes("googleSignInUnavailableReason"));
t("signInWithGoogle throws a coded error when unavailable", google.includes("GOOGLE_SIGNIN_UNAVAILABLE"));

// ---- and Login shows that message instead of the generic one ----
t("Login handles GOOGLE_SIGNIN_UNAVAILABLE", login.includes("GOOGLE_SIGNIN_UNAVAILABLE"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
