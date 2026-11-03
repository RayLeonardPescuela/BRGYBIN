// Guards the Android double-back logout ("Press back again to log out
// and exit") against the bug where it only fired once you had backed
// all the way to a root screen -- the reported "3 taps of back".
//
// BackHandler.android.js dispatches `hardwareBackPress` to listeners in
// REVERSE registration order (last registered first), stops at the first
// listener returning true, and calls BackHandler.exitApp() when nobody
// returns true. React Navigation registers its own listener inside
// NavigationContainer's mount effect and returns true whenever the stack
// can still pop.
//
// So if <BackButtonHandler /> mounts BEFORE the container (renders above
// </NavigationContainer>) it registers first, runs LAST, and never sees
// the press on an inner screen. Rendering it after the container flips
// the order so our listener runs first and the toast fires on the first
// back press of every screen.
//
// Running first also means the handler must not swallow every press: a
// blanket `true` would break hardware back navigation everywhere, and a
// blanket `false` would let BackHandler's exitApp() fall-through kill the
// app on the FIRST press at the root, with no logout. It has to consult
// canGoBack() and hand pops back to React Navigation.
//
// These checks stop someone "tidying up" the render order or the return
// values. Comments are stripped first so prose cannot satisfy the order
// checks (the handler's own comments mention </NavigationContainer>).
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

// ---- the library premises this whole fix leans on ----
// If React Native or React Navigation ever change these semantics, the
// render order below stops meaning what the comment claims.
const rnBack = readFileSync(
  "node_modules/react-native/Libraries/Utilities/BackHandler.android.js",
  "utf8"
);
const navBack = readFileSync(
  "node_modules/@react-navigation/native/lib/module/useBackButton.native.js",
  "utf8"
);

t("RN still dispatches listeners last-registered-first",
  /for \(let i = .*length - 1/.test(rnBack));
t("RN still exits the app when no listener returns true",
  rnBack.includes("BackHandler.exitApp()"));
t("React Navigation still pops and consumes only while it can go back",
  navBack.includes("navigation.canGoBack()") &&
    navBack.includes("navigation.goBack()"));

// ---- App.js ----
const app = readFileSync("App.js", "utf8");
const code = app
  .replace(/\/\*[\s\S]*?\*\//g, "")      // block + JSX comments
  .replace(/(^|[^:])\/\/.*$/gm, "$1");   // line comments, keep :// in URLs

// ---- render order: our listener must register AFTER React Navigation's ----
const handlerAt = code.indexOf("<BackButtonHandler");
const containerEnd = code.indexOf("</NavigationContainer>");
t("BackButtonHandler renders after </NavigationContainer>",
  handlerAt !== -1 && containerEnd !== -1 && handlerAt > containerEnd,
  `handler@${handlerAt} </NavigationContainer>@${containerEnd}`);
t("BackButtonHandler is rendered exactly once",
  (code.match(/<BackButtonHandler/g) || []).length === 1);

// ---- the handler body ----
const defStart = code.indexOf("function BackButtonHandler");
const defEnd = code.indexOf("function NotificationTapThrough", defStart);
t("BackButtonHandler definition located", defStart !== -1 && defEnd > defStart);
const body = defStart !== -1 && defEnd > defStart
  ? code.slice(defStart, defEnd)
  : "";

t("handler takes the navigationRef prop",
  /function BackButtonHandler\(\{\s*navigationRef\s*\}\)/.test(body));
t("render site passes the ref",
  /<BackButtonHandler\s+navigationRef=\{navigationRef\}/.test(code));
t("handler stays Android-only", body.includes('Platform.OS !== "android"'));
t("second press signs out, then exits",
  body.includes("signOutAndCleanup()") && body.includes("BackHandler.exitApp()"));
t("toast copy kept", body.includes("Press back again to log out and exit"));

// ---- first press: cooperate with React Navigation, never swallow blindly ----
const canGoBackAt = body.indexOf("canGoBack()");
t("first press consults canGoBack()", canGoBackAt !== -1);
if (canGoBackAt !== -1) {
  const tail = body.slice(canGoBackAt);
  // pops are handed back so hardware back keeps navigating...
  t("pops are handed back to React Navigation (return false)",
    tail.includes("return false"));
  // ...but the root press is consumed, otherwise BackHandler's
  // fall-through calls exitApp() with no logout confirmation.
  t("root press is consumed (return true)", tail.includes("return true"));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
