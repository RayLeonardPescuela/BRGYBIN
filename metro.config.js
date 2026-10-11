const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs");

// ---------------------------------------------------------------------------
// Keep expo-notifications working inside Expo Go on Android.
//
// expo-notifications' DevicePushTokenAutoRegistration.fx.js is a side-effect
// module: importing the library runs addPushTokenListener() at module load,
// and on Android inside Expo Go that call THROWS (the library throws rather
// than warns there since SDK 53). The result is a hard "[runtime not ready]"
// crash before React mounts, and there is no config flag that disables it.
//
// Only the PUSH/remote APIs guard on that. Every local notification API
// (scheduling, channels, permissions, cancel-all) is unaffected, so
// replacing just this one push-only file lets collection reminders run in
// Expo Go. See config/notificationsFxStub.js for the full write-up.
//
// Safe in a development build too: the stubbed file only handled Expo's
// automatic token-to-server registration, which this app does not use — it
// registers its own token with Firestore.
// ---------------------------------------------------------------------------
const NOTIFICATIONS_FX = "DevicePushTokenAutoRegistration";
const NOTIFICATIONS_FX_STUB = path.resolve(
  __dirname,
  "config/notificationsFxStub.js"
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes(NOTIFICATIONS_FX)) {
    return { type: "sourceFile", filePath: NOTIFICATIONS_FX_STUB };
  }

  // Metro guarantees context.resolveRequest is Metro's OWN default
  // resolver, never this configured function, so delegating here cannot
  // recurse. This is the documented way to fall through to default
  // behaviour. (Do not capture config.resolver.resolveRequest instead:
  // getDefaultConfig sets it to null, not to a function.)
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
