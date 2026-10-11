// Guards the read-state contract between the two projects.
//
// BRNGYBIN (the app) and BRNGYBIN-Web (the admin portal) are separate
// codebases with separate git histories, but they share ONE Firestore
// project. Anything either side writes is the other side's input.
//
// Phase 3 moved read state from a single shared `read` boolean to a
// per-user `readBy` uid array. That fixed the real bug — the first resident
// to open a broadcast used to mark it read for the ENTIRE barangay — but it
// silently broke the admin portal, which still rendered a badge from
// `n.read`. That flag is never written again, so the badge sat permanently
// on "unread" with nothing anyone could do about it.
//
// These assertions pin the contract so neither side can drift again:
// the app must not resurrect the shared flag, and the web must count
// readers instead of trusting it.
//
// The web project is a SIBLING directory, not part of this repo, so a
// checkout without it skips those checks rather than failing or — worse —
// passing silently as if they had run.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

let pass = 0, fail = 0, skipped = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};
const skip = (label, why) => { skipped++; console.log("skip " + label + " -> " + why); };

const APP_ROOT = process.cwd();
const WEB_ROOT = path.resolve(APP_ROOT, "..", "BRNGYBIN-Web");
const WEB_NOTIFICATIONS = path.join(WEB_ROOT, "src", "pages", "Notifications.jsx");

/* ============================================================
 * 1. The app must not write a shared `read` flag again
 * ============================================================ */
// Every source file that could touch the notifications collection.
const appFiles = [
  "config/unreadNotifications.js",
  "screens/Notification.js",
  "screens/CreateNotification.js",
]
  .map((p) => path.join(APP_ROOT, p))
  .filter(existsSync);

t("app sources located", appFiles.length >= 2, `found ${appFiles.length}`);

const appSource = appFiles.map((p) => readFileSync(p, "utf8")).join("\n");

t("app tracks read state in readBy", /readBy/.test(appSource));
t("app appends uids rather than setting a flag", /arrayUnion\([^)]*uid\)/.test(appSource));

// The precise hazard: an assignment of a boolean to `read` on a
// notification document. Comments are stripped so the rationale, which
// necessarily names the old flag, cannot trigger this.
const appCode = appSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
t("app never writes a shared `read` flag",
  !/read:\s*(true|false)/.test(appCode));

/* ============================================================
 * 2. The web portal must count readers, not trust the flag
 * ============================================================ */
if (!existsSync(WEB_NOTIFICATIONS)) {
  skip("web portal read-state contract",
    `not found at ${WEB_ROOT} — sibling project not checked out`);
} else {
  const web = readFileSync(WEB_NOTIFICATIONS, "utf8");

  const webCode = web
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  t("web reads the per-user readBy array", /readBy/.test(webCode));
  t("web no longer writes the dead `read: false`",
    !/read:\s*false/.test(webCode));
  t("web no longer renders a boolean read badge",
    !/n\.read\s*\?/.test(webCode));
  t("web counts distinct resident readers",
    /countReadByResidents|readers\.has/.test(webCode));

  // A count needs a denominator. The portal must actually derive the
  // resident population, otherwise "X of Y read" degrades to "X of
  // undefined".
  t("web derives the resident denominator",
    /residentIds/.test(webCode) && /isStaff/.test(webCode));

  // Legacy `read: true` docs mean everyone had read them under the old
  // model, and the app's isRead() still honours that. The web must agree
  // or the ratio will contradict what residents actually see.
  t("web honours legacy read:true as fully read",
    /n\.read === true/.test(webCode));

  // Only residents may count: staff taps and deleted accounts must not
  // inflate the numerator past the denominator.
  t("web excludes staff from the count",
    /!isStaff\(/.test(webCode));
}

console.log("\n" + pass + " passed, " + fail + " failed, " + skipped + " skipped");
process.exit(fail ? 1 : 0);
