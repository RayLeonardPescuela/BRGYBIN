import { Platform } from "react-native";
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

let GoogleSignin = null;
if (isNative) {
  // eslint-disable-next-line global-require
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
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

  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo?.idToken || userInfo?.user?.idToken;
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
  const result = await auth.signInWithCredential(credential);
  return result.user;
}
