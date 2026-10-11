// Guards the unread badge against the one failure that would actually
// confuse a resident: the dashboard badge counting a different set than
// the inbox can display.
//
// If they drift, "Mark all as read" can empty the list while the badge
// stays stuck on a number with no way to clear it — a loop with no exit.
// These assertions force both screens through the shared module in
// config/unreadNotifications.js.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

const shared = readFileSync("config/unreadNotifications.js", "utf8");
const inbox = readFileSync("screens/Notification.js", "utf8");
const home = readFileSync("screens/Home.js", "utf8");
const badge = readFileSync("components/NotificationBadge.js", "utf8");

// ---- the shared module owns the logic, once ----
t("shared module exports isRead", /export const isRead\s*=/.test(shared));
t("shared module exports visibleTo", /export const visibleTo\s*=/.test(shared));
t("shared module exports countUnread", /export const countUnread\s*=/.test(shared));
t("shared module exports the fetch", /export async function fetchVisibleNotifications/.test(shared));
t("shared module exposes the useUnreadCount hook", /export function useUnreadCount/.test(shared));

// ---- and the inbox must NOT carry a second copy ----
t("inbox does not redefine isRead", !/^\s*const isRead\s*=/m.test(inbox));
t("inbox does not redefine visibleTo", !/^\s*const visibleTo\s*=/m.test(inbox));
t("inbox does not redefine addUnique", !/^\s*const addUnique\s*=/m.test(inbox));
t("inbox imports them from the shared module",
  /from "\.\.\/config\/unreadNotifications"/.test(inbox));

// ---- the caps live in one place ----
// A hardcoded .limit() or .slice() in the inbox is exactly how the two
// sets would silently diverge.
t("shared module defines the fetch limit", /NOTIFICATIONS_FETCH_LIMIT\s*=\s*\d+/.test(shared));
t("shared module defines the display limit", /NOTIFICATIONS_DISPLAY_LIMIT\s*=\s*\d+/.test(shared));
t("inbox has no hardcoded .limit(N)", !/\.limit\(\s*\d+\s*\)/.test(inbox));
t("inbox has no hardcoded .slice(0, N)", !/\.slice\(\s*0\s*,\s*\d+\s*\)/.test(inbox));
t("inbox fetch goes through the shared helper",
  /fetchVisibleNotifications\(/.test(inbox));
t("inbox counts unread through the shared helper",
  /countUnread\(/.test(inbox));

// ---- the fetch applies the display cap, not just the fetch limit ----
const fetchBody = shared.slice(shared.indexOf("fetchVisibleNotifications"));
t("fetch caps to the display limit",
  /\.slice\(0, NOTIFICATIONS_DISPLAY_LIMIT\)/.test(fetchBody));

// ---- dashboard wiring ----
t("Home uses the shared hook", /useUnreadCount\(/.test(home));
t("Home renders the badge component", /<NotificationBadge\s+count=\{unreadCount\}/.test(home));
t("Home imports the badge component",
  /import NotificationBadge from "\.\.\/components\/NotificationBadge"/.test(home));
// The badge needs a fixed-size box to anchor its absolute offset to the
// icon corner, otherwise it drifts with the tile.
t("Home wraps the bell in an anchoring View", /styles\.bellIconWrap/.test(home));
t("bellIconWrap is defined", /bellIconWrap:\s*\{/.test(home));

// ---- the badge itself ----
t("badge renders nothing at zero", /if \(!count \|\| count <= 0\) return null;/.test(badge));
t("badge caps its label", /\$\{max\}\+/.test(badge));
t("badge is absolutely positioned", /position: "absolute"/.test(badge));
t("badge uses the shared red", /COLORS\.red/.test(badge));

// ---- the hook refreshes on focus ----
// Without this the badge would only update on a cold start, so returning
// from the inbox would leave a stale count on the bell.
t("hook refetches on focus", /useFocusEffect\(/.test(shared));
t("hook degrades to 0 on error", /setCount\(0\);/.test(shared));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
