// ============================================================
// config/unreadNotifications.js
//
// Single source of truth for what counts as an UNREAD notification.
//
// The inbox (screens/Notification.js) and the dashboard badge both need
// this, and they must never disagree. If the badge counted a different
// set than the list can actually show, "Mark all as read" could empty
// the inbox while the badge stayed stuck at a number the user has no
// way to clear — a loop with no way out.
//
// So the query, the sitio filter AND the display cap all live here and
// are shared verbatim.
// ============================================================ */

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "./firebase";
import { useUser } from "./UserContext";
import { canViewAdminPanel } from "./roles";
import { normalizeSitio } from "./reminders";

// How many docs we pull from Firestore...
export const NOTIFICATIONS_FETCH_LIMIT = 50;
// ...and how many the inbox actually renders. The badge counts within
// this same capped set, so it can always be fully cleared.
export const NOTIFICATIONS_DISPLAY_LIMIT = 20;

/* ------------------------------------------------------------
 * READ STATE — per user, not per notification
 *
 * The old model stored ONE boolean (`read`) on the shared doc, so the
 * first resident to tap a notification marked it read for EVERYONE:
 * the badge emptied across the whole barangay and the unread styling
 * vanished for people who never opened it.
 *
 * Read state now lives in a `readBy` array; each reader appends their
 * own uid.
 *
 * Legacy docs still carry `read` and no `readBy`. Honouring
 * `read === true` keeps old broadcasts visibly read instead of
 * flipping them back to unread for everyone. No migration is needed:
 * `read` is never written again, so legacy `false` values retire on
 * their own while legacy `true` keeps applying on top. The moment
 * someone taps a legacy doc it begins tracking per-user state too.
 * ------------------------------------------------------------ */
export const isRead = (notification, uid) =>
  notification.read === true ||
  (Array.isArray(notification.readBy) && notification.readBy.includes(uid));

// Mirrors what arrayUnion will do on the server, for optimistic state.
export const addUnique = (list, value) =>
  Array.isArray(list) && list.includes(value) ? list : [...(list || []), value];

/* ------------------------------------------------------------
 * SITIO SCOPING
 *
 *   staff              -> the whole barangay
 *   "All Sitios"       -> empty/missing sitio, so everyone sees it
 *   a resident         -> barangay-wide plus their own sitio
 *   resident w/o sitio -> barangay-wide only (they match no specific one)
 *
 * Compared normalized, so a stray space or capital in a sitio name
 * cannot silently hide an announcement.
 * ------------------------------------------------------------ */
export const visibleTo = (notification, userData) => {
  if (canViewAdminPanel(userData)) return true;

  const targeted = normalizeSitio(notification.sitio);
  if (!targeted) return true; // "All Sitios"

  const mine = normalizeSitio(userData?.sitio);
  return !!mine && targeted === mine;
};

/**
 * The exact list the inbox shows: newest first, scoped to this user's
 * role + sitio, capped to the same length the badge counts within.
 */
export async function fetchVisibleNotifications(userData) {
  const snapshot = await db
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(NOTIFICATIONS_FETCH_LIMIT)
    .get();

  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return data
    .filter((n) => visibleTo(n, userData))
    .slice(0, NOTIFICATIONS_DISPLAY_LIMIT);
}

export const countUnread = (notifications, uid) =>
  notifications.filter((n) => !isRead(n, uid)).length;

/**
 * Live unread count for the dashboard badge.
 *
 * Refetches whenever the screen regains focus, so coming back from the
 * inbox updates the badge without a manual pull. Reads are cheap here —
 * one query, capped at NOTIFICATIONS_FETCH_LIMIT.
 *
 * A failure is never fatal: the badge is decoration, so it degrades to
 * 0 rather than taking the dashboard down with it.
 */
export function useUnreadCount() {
  const { user, userData } = useUser();
  const uid = user?.uid;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    // userData is undefined until the profile has loaded; there is
    // nothing to scope against yet.
    if (!uid || userData === undefined) return;

    try {
      const list = await fetchVisibleNotifications(userData);
      setCount(countUnread(list, uid));
    } catch (error) {
      console.log("Error loading unread count:", error);
      setCount(0);
    }
  }, [uid, userData]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { count, refresh };
}
