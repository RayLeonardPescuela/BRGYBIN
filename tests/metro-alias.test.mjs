// Verifies the Metro alias that keeps expo-notifications importable
// inside Expo Go on Android.
//
// Without it, importing expo-notifications crashes Expo Go on a
// "[runtime not ready]" error: DevicePushTokenAutoRegistration.fx.js runs
// addPushTokenListener() at module load, which throws on Android in Expo
// Go. The app could not start at all.
//
// This loads the real metro.config.js and invokes the resolver, so it
// fails if someone deletes the rule, points it at the wrong file, or if a
// Metro upgrade changes how the default resolver is preserved.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

// ---- the config loads and exposes a custom resolver ----
const config = require("../metro.config.js");
t("metro.config.js loads", !!config);
t("resolver.resolveRequest is installed",
  typeof config.resolver.resolveRequest === "function");

// ---- the alias itself ----
// Specifiers come in several shapes: relative from inside the library,
// and bare with the extension. All must map to the stub.
const stub = path.resolve(process.cwd(), "config/notificationsFxStub.js");
const resolvers = [
  ["./DevicePushTokenAutoRegistration.fx", "library's own import"],
  ["expo-notifications/build/DevicePushTokenAutoRegistration.fx", "absolute-ish"],
  ["DevicePushTokenAutoRegistration.fx.js", "with extension"],
];

for (const [spec, label] of resolvers) {
  let result;
  try {
    result = config.resolver.resolveRequest(config.resolver, spec, "android");
  } catch (error) {
    // Only acceptable if it did not resolve to the stub via a wrong path.
    result = null;
  }
  t(`alias ${label}`, result?.filePath === stub, result?.filePath ?? "threw");
}

// ---- the stub must export exactly what the library imports ----
// getExpoPushTokenAsync.js imports setAutoServerRegistrationEnabledAsync,
// and index.js re-exports it. A missing export breaks the library.
const stubSource = readFileSync(stub, "utf8");
t("stub file exists", existsSync(stub));
t("stub exports setAutoServerRegistrationEnabledAsync",
  /export\s+(?:async\s+)?function\s+setAutoServerRegistrationEnabledAsync/.test(stubSource));
t("stub exports __handlePersistedRegistrationInfoAsync",
  /export\s+(?:async\s+)?function\s+__handlePersistedRegistrationInfoAsync/.test(stubSource));

// ---- and it must NOT pull expo-notifications back in ----
// If the stub imported the library it would re-trigger the very crash it
// exists to prevent.
t("stub does not import expo-notifications",
  !/require\s*\(\s*["']expo-notifications["']\s*\)/.test(stubSource) &&
  !/from\s+["']expo-notifications["']/.test(stubSource));

// ---- other modules must still use Expo's real resolver ----
// Metro guarantees context.resolveRequest is Metro's OWN default
// resolver, never the configured function. Simulate that contract: if the
// rule delegates correctly the spy is called once with the original
// specifier. If the rule ever recursed instead, this would overflow the
// stack rather than silently pass.
let delegated = null;
const metroContext = {
  resolveRequest: (ctx, name, platform) => {
    delegated = name;
    return {
      type: "sourceFile",
      filePath: path.join(process.cwd(), "metro-default.js"),
    };
  },
};

const unrelated = config.resolver.resolveRequest(metroContext, "react-native", "android");
t("unrelated module delegates to Metro's default resolver",
  delegated === "react-native", String(delegated));
t("unrelated module is not aliased to the stub",
  !unrelated.filePath.endsWith("notificationsFxStub.js"),
  unrelated.filePath);

// ---- the alias short-circuits before delegating ----
// Calling the resolver with an empty module name must return the stub and
// must NOT reach Metro's default resolver, which would choke on it.
delegated = null;
const aliased = config.resolver.resolveRequest(metroContext, "xDevicePushTokenAutoRegistrationx", "android");
t("alias short-circuits without delegating", delegated === null, String(delegated));
t("alias resolves to the stub", aliased.filePath === stub);

// ---- rule 2: missing native shims fall back to the library's own stub ----
const notificationsOrigin = path.join(
  process.cwd(), "node_modules", "expo-notifications", "build", "topicSubscription.js"
);

const redirected = config.resolver.resolveRequest(
  { originModulePath: notificationsOrigin, ...metroContext },
  "./TopicSubscriptionModule",
  "android"
);
t("TopicSubscriptionModule redirects on android",
  redirected.filePath.endsWith(path.join("expo-notifications", "build", "TopicSubscriptionModule.js")),
  redirected.filePath);

// The target must be the SAFE variant: a plain object, no native lookup.
const targetSrc = readFileSync(redirected.filePath, "utf8");
t("redirect target does not call requireNativeModule",
  !/requireNativeModule\s*\(/.test(targetSrc));
t("target exports a resolving stub",
  /subscribeToTopicAsync/.test(targetSrc));

// Must not leak outside expo-notifications, and must be android-only.
const foreign = config.resolver.resolveRequest(
  { originModulePath: path.join(process.cwd(), "screens", "Home.js"), ...metroContext },
  "./TopicSubscriptionModule",
  "android"
);
t("same-named app module is not redirected",
  !foreign.filePath.endsWith("TopicSubscriptionModule.js"),
  foreign.filePath);

const ios = config.resolver.resolveRequest(
  { originModulePath: notificationsOrigin, ...metroContext },
  "./TopicSubscriptionModule",
  "ios"
);
t("iOS keeps its native module",
  !ios.filePath.endsWith(path.join("build", "TopicSubscriptionModule.js")),
  ios.filePath);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
