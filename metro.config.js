const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs");

// ===========================================================================
// Keep expo-notifications importable inside Expo Go on Android.
//
// expo-notifications cannot be imported at all in Expo Go on Android since
// SDK 53. Its native module shims are written as:
//
//     export default requireNativeModule('ExpoSomething');   // .android.js
//
// and requireNativeModule THROWS when the module is absent. Expo Go does not
// bundle every module the library expects, and because Metro prefers
// platform-specific extensions over the generic file, the hard variant wins
// and the app dies with "[runtime not ready]" before React mounts.
//
// Crucially, the library ALSO ships a generic in-JS fallback for each of
// these shims — plain objects of no-op/Promise-resolving functions. That is
// the variant iOS and web get. We are simply steering Android back to the
// same fallback the library already provides, not inventing behaviour.
//
// The list below only contains modules this app never calls. Every entry is
// inert for us, so nothing that worked before stops working.
// ===========================================================================

const NOTIFICATIONS_BUILD = path.join(
  path.dirname(require.resolve("expo-notifications/package.json")),
  "build"
);

// --- 1. Push auto-registration side effect ---------------------------------
// DevicePushTokenAutoRegistration.fx.js runs addPushTokenListener() at module
// load, which calls warnOfExpoGoPushUsage() — and that THROWS on Android
// inside Expo Go. Only push APIs guard on it; no local notification API does.
// See config/notificationsFxStub.js for the full write-up.
const NOTIFICATIONS_FX = "DevicePushTokenAutoRegistration";
const NOTIFICATIONS_FX_STUB = path.resolve(
  __dirname,
  "config/notificationsFxStub.js"
);

// --- 2. Native shims Expo Go does not bundle -------------------------------
// Map of module base name -> reason. To add the next landmine, append its
// base name here; the library's own generic stub is used automatically.
const EXPO_GO_MISSING_NATIVE = {
  // Push topic subscription. Firebase-specific, never used by this app — the
  // reminders reach devices through the Expo Push Service, not FCM topics.
  TopicSubscriptionModule: "push topic subscription is unavailable in Expo Go",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // --- rule 1: neutralise the push side-effect module ---
  if (moduleName.includes(NOTIFICATIONS_FX)) {
    return { type: "sourceFile", filePath: NOTIFICATIONS_FX_STUB };
  }

  // --- rule 2: use the library's own generic fallback for missing natives ---
  // Scoped to android (iOS and web already resolve to the safe file), and to
  // imports originating inside expo-notifications so we can never intercept
  // an app-level module that happens to share a name.
  const base = path.basename(moduleName);
  if (
    platform === "android" &&
    EXPO_GO_MISSING_NATIVE[base] &&
    context.originModulePath?.includes("expo-notifications")
  ) {
    return {
      type: "sourceFile",
      filePath: path.join(NOTIFICATIONS_BUILD, `${base}.js`),
    };
  }

  // Metro guarantees context.resolveRequest is Metro's OWN default resolver,
  // never this configured function, so delegating here cannot recurse. This
  // is the documented way to fall through to default behaviour. (Do not
  // capture config.resolver.resolveRequest instead: getDefaultConfig sets it
  // to null, not to a function.)
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
