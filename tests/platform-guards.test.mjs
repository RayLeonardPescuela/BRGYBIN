// Regression guards for the web crash where
// `useLastNotificationResponse()` was called unconditionally in App().
// expo-notifications has no `getLastNotificationResponse` on web, so its
// layout effect threw UnavailabilityError and took the whole app down on
// `expo start --web`.
//
// A hook cannot be called conditionally, so the only correct fix is to
// keep it inside a component that is never mounted on web. These checks
// stop someone "simplifying" that back into App().
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

const app = readFileSync("App.js", "utf8");
const reminders = readFileSync("config/reminders.js", "utf8");

// ---- the hook must live only inside NotificationTapThrough ----
// Note: matching the call form with parens so the bare import statement
// does not count as a use.
const beforeComponent = app.slice(0, app.indexOf("function NotificationTapThrough"));
t("hook not called above the component", !beforeComponent.includes("useLastNotificationResponse()"));

const appBody = app.slice(app.indexOf("export default function App"));
t("hook not called inside App()", !appBody.includes("useLastNotificationResponse()"));
t("hook IS used somewhere (not deleted)", app.includes("useLastNotificationResponse()"));

// ---- and it must be mounted behind a web guard ----
t("tap-through is behind a web guard", app.includes('Platform.OS !== "web"'));
t("tap-through component is rendered", /<NotificationTapThrough\b/.test(app));

// ---- notification bootstrap must not touch native APIs on web ----
t("initNotifications guards web",
  /if \(Platform\.OS === "web"\) return false;/.test(reminders));
t("registerPushToken guards web",
  /if \(Platform\.OS === "web"\) return null;/.test(reminders));

// ---- Platform must actually be imported where it is used ----
t("App.js imports Platform", /import\s*{[^}]*\bPlatform\b[^}]*}\s*from\s*"react-native"/.test(app));
t("reminders.js imports Platform", /import\s*{[^}]*\bPlatform\b[^}]*}\s*from\s*"react-native"/.test(reminders));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
