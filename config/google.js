import { Platform, TurboModuleRegistry } from "react-native";
import firebase from "firebase/compat/app";
import { auth } from "./firebase";

// Real OAuth Web client ID (Google Cloud Console -> APIs & Services ->
// Credentials). The webClientId is what lets the SDK mint the ID token that
// Firebase verifies — without a real one, Google refuses to issue it and
// sign-in fails every time.
const WEB_CLIENT_ID =
  "188250769398-u07g3t30ucemff1l5mg8ba24ql7anepj.apps.googleusercontent.com";

// The native Google SDK has no implementation on web. Requiring it there
// throws (UnavailabilityError / missing native module), so the require is
// guarded by this flag and simply never executes in the browser bundle.
// The browser path uses Firebase's signInWithPopup instead.
const isNative = Platform.OS !== "web";

// `GoogleSignin` is NATIVE. Requiring the JS library immediately runs
// `TurboModuleRegistry.getEnforcing('RNGoogleSignin')`, which THROWS when
// the module is not compiled into the binary that is currently running.
//
// That is exactly what happens in Expo Go: this library needs a dev or
// production build (`npx expo run:android` / EAS). Because Login.js imports
// this file from App.js, the throw happened while the bundle was still
// booting, so the app never reached a single screen — red screen,
// "Invariant Violation: TurboModuleRegistry.getEnforcing(...):
// 'RNGoogleSignin' could not be found."
//
// `get()` is the non-throwing twin of `getEnforcing()`: null when the module
// isn't linked. Ask it FIRST and only require the library when the native
// side is really there, so the app boots everywhere and Google sign-in
// degrades to a clear message instead of a crash.
const hasNativeModule =
  isNative && TurboModuleRegistry.get("RNGoogleSignin") != null;

let GoogleSignin = null;
// Set only when native Google sign-in genuinely cannot work (Expo Go, or a
// build where the module is missing). Stays null on web, where the popup
// path is used instead.
let unavailableReason = null;

if (hasNativeModule) {
  try {
    // eslint-disable-next-line global-require
    GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  } catch (err) {
    // Defensive: the module is linked but still failed to initialise.
    GoogleSignin = null;
    unavailableReason = "Google Sign-In failed to initialise on this device.";
    console.warn("Google Sign-In unavailable:", err?.message);
  }
} else if (isNative) {
  unavailableReason =
    "Google Sign-In isn't available in Expo Go — it needs a build of the app. " +
    "Log in with your email and password instead.";
}

/**
 * Why native Google sign-in cannot be used right now, or null when it can
 * (web always can — it uses the Firebase popup).
 */
export function googleSignInUnavailableReason() {
  return unavailableReason;
}

/**
 * Platform-appropriate Google sign-in.
 *
 * Authenticates the user with Firebase Auth and returns the Firebase user.
 * It does NOT read or create the Firestore profile doc — the caller decides
 * whether this is a returning user (route them in) or a new one (register).
 *
 * Throws on failure; "user cancelled" surfaces as a code the caller can
 * check (SIGN_IN_CANCELLED on native, auth/popup-closed-by-user on web).
 */
export async function signInWithGoogle() {
  if (!isNative) {
    const provider = new firebase.auth.GoogleAuthProvider();
    const credential = await auth.signInWithPopup(provider);
    return credential.user;
  }

  if (!GoogleSignin) {
    const error = new Error(
      unavailableReason ||
        "Google Sign-In isn't available in this build of the app."
    );
    error.code = "GOOGLE_SIGNIN_UNAVAILABLE";
    throw error;
  }

  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo?.idToken || userInfo?.user?.idToken;
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
  const result = await auth.signInWithCredential(credential);
  return result.user;
}
