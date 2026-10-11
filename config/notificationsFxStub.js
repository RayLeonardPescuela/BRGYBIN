// Metro aliases expo-notifications' DevicePushTokenAutoRegistration.fx
// module to this file. See the resolveRequest rule in metro.config.js.
//
// WHY THIS EXISTS
// ---------------
// DevicePushTokenAutoRegistration.fx.js is a SIDE-EFFECT module: as soon
// as anything imports expo-notifications, its top level runs
//
//     if (ServerRegistrationModule.getRegistrationInfoAsync) {
//         addPushTokenListener(async (token) => { ... });
//     }
//
// On Android, ServerRegistrationModule.native.js resolves to a real
// native module, so that condition is TRUE even inside Expo Go. And
// addPushTokenListener() calls warnOfExpoGoPushUsage(), which THROWS
// rather than warns whenever Platform.OS === "android" && isRunningInExpoGo().
//
// Net effect: importing expo-notifications hard-crashes Expo Go on
// Android with "removed from Expo Go with the release of SDK 53", before
// React even mounts. That is a library-level throw with no config flag
// to disable it.
//
// WHAT THIS PRESERVES
// -------------------
// warnOfExpoGoPushUsage() is only ever called from four push/remote
// functions:
//     getDevicePushTokenAsync.js:14
//     TokenEmitter.js:33          <- the crash
//     topicSubscription.js:14
//     topicSubscription.js:27
//
// No LOCAL notification API calls it. Scheduling, channels, permission
// prompts and cancellation are all unaffected — they were always fine in
// Expo Go. Neutralising this one push-only side-effect module therefore
// lets collection reminders run in Expo Go without changing any real
// behaviour, while a development build's notification support stays
// exactly as it was.
//
// The two exports below exist only so the library's own imports still
// resolve. Auto server registration is not used at all: this app
// registers its own token with Firestore, so the real implementations
// were never doing anything for us.

/** No-op: tokens are registered with Firestore by this app, not Expo's. */
export async function setAutoServerRegistrationEnabledAsync() {
  // Intentionally empty.
}

/** No-op: there is no persisted auto-registration state to replay. */
export async function __handlePersistedRegistrationInfoAsync() {
  // Intentionally empty.
}
