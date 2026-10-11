// ============================================================
// config/reminders.js — collection reminder notifications
//
// PHASE 1: channel + permission + display handler
// PHASE 2: local scheduling (the "device" delivery path)  ← this file
// PHASE 4: GitHub Actions + FCM (the "server" delivery path)
//
// DELIVERY MODES — exactly ONE owns delivery, so a resident
// never receives the same reminder twice:
//
//   "device" -> this phone schedules its own T-10 / T-5 alarms
//               (fires with the app killed & offline; needs one
//                app-open to arm them)
//   "server" -> GitHub Actions cron sends via FCM
//               (fires even if the app was never opened)
//
// While mode is "device", syncCollectionReminders() arms the phone.
// When mode flips to "server", the same function clears local alarms
// so only FCM delivers. Nothing else has to change.
// ============================================================

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { db } from "./firebase";
import { canViewAdminPanel } from "./roles";

/* ============================================================
 * CONSTANTS
 * ============================================================ */

export const NOTIF_CHANNEL_ID = "collection-reminders";
export const NOTIF_CHANNEL_NAME = "Collection Reminders";

// Minutes before the collection time. Shared by the local scheduler
// and (Phase 4) by the server-side cron.
export const REMINDER_OFFSETS_MIN = [10, 5];

// How far ahead we arm local alarms on every sync.
export const LOOKAHEAD_DAYS = 14;

export const DELIVERY_MODES = {
  SERVER: "server",
  DEVICE: "device",
};

/* ============================================================
 * DELIVERY RESOLVER — the single if/else
 *
 * Phase 4 flips this once push tokens are registered and the
 * GitHub Actions workflow is enabled. This is the ONLY place
 * in the app that decides which mode is active.
 * ============================================================ */
export function resolveDeliveryMode() {
  return DELIVERY_MODES.DEVICE;
}

/* ============================================================
 * SITIO MATCHING
 *
 * Firestore `where` is exact-match, so we filter client-side and
 * compare normalized values. Without this a stray space or capital
 * ("Buanoy Centro" vs "buanoy  centro ") would silently deliver to
 * nobody — the worst possible failure mode.
 *
 * Whitespace runs collapse to one space. Two sitio names can only
 * collide if they are identical modulo spacing, which means they are
 * the same sitio — so this gains tolerance without false matches.
 * ============================================================ */
export const normalizeSitio = (value) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/* ============================================================
 * TIME PARSING  ("8:00 AM" <-> Date)
 *
 * Stored format is always "8:00 AM" (what the rest of the app
 * renders). parseTimeToDate() stays tolerant so schedules written
 * by the old free-text field still work.
 * ============================================================ */

const withTime = (h, m) =>
  new Date(2000, 0, 1, Math.max(0, Math.min(23, h)), Math.max(0, Math.min(59, m)), 0, 0);

// STRICT — returns null when the value isn't a recognizable time.
// The scheduler uses this: guessing 8:00 AM for a corrupt time would
// fire a real resident's reminder at the wrong hour.
export function parseTimeStrict(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // 12-hour: "8:00 AM" | "8AM" | "12:15pm"
  const ampm = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (ampm) {
    const minutes = parseInt(ampm[2] || "0", 10);
    if (minutes > 59) return null;
    let h = parseInt(ampm[1], 10) % 12;
    if (/[Pp]/.test(ampm[3])) h += 12;
    return withTime(h, minutes);
  }

  // 24-hour: "14:30" | "08:00"
  const h24 = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (h24 && parseInt(h24[1], 10) <= 23 && parseInt(h24[2], 10) <= 59) {
    return withTime(parseInt(h24[1], 10), parseInt(h24[2], 10));
  }

  // Hour only: "8"
  const hourOnly = raw.match(/^(\d{1,2})$/);
  if (hourOnly && parseInt(hourOnly[1], 10) <= 23) {
    return withTime(parseInt(hourOnly[1], 10), 0);
  }

  // Last resort: let Date parse it (covers odd legacy entries).
  // Guard the day boundary: V8 leniently accepts "24:00" by rolling it
  // into the next day, which would silently schedule a reminder 24h late.
  const parsed = new Date(`2000-01-01 ${raw}`);
  if (!isNaN(parsed.getTime())) {
    if (
      parsed.getFullYear() !== 2000 ||
      parsed.getMonth() !== 0 ||
      parsed.getDate() !== 1
    ) {
      return null;
    }
    return withTime(parsed.getHours(), parsed.getMinutes());
  }

  return null;
}

// TOLERANT — never returns null. Used for DISPLAY only, where an
// 08:00 fallback beats rendering an empty time field.
export function parseTimeToDate(value) {
  return parseTimeStrict(value) || new Date(2000, 0, 1, 8, 0, 0);
}

export function formatTime(date) {
  if (!date) return "";
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

/* ============================================================
 * DATE PARSING
 *
 * Moved verbatim out of Home.js so the "next pickup" dashboard
 * and the reminder scheduler can never disagree about when a
 * collection happens. Handles Firestore Dates, "YYYY-MM-DD",
 * "June 26", "Jun 26, 2026" and anything else Date accepts.
 * ============================================================ */

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export function parseScheduleDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") return value.toDate();

  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM-DD (with or without a time part)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // "June 26", "June 26, 2026", "Jun 26 2026"
  const named = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
  if (named) {
    const name = named[1].toLowerCase();
    let month = MONTH_NAMES.indexOf(name);
    if (month === -1) month = MONTH_NAMES.findIndex((m) => m.startsWith(name));
    if (month !== -1) {
      const day = +named[2];
      let year = named[3] ? +named[3] : new Date().getFullYear();
      // No year given: if that date already passed, roll to next year's occurrence
      if (!named[3] && new Date(year, month, day) < startOfToday()) year += 1;
      return new Date(year, month, day);
    }
  }

  // Fallback for other formats (e.g. 06/26/2026)
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// "2026-10-14" + "8:00 AM" -> Date(2026, 9, 14, 8, 0)
// Returns null when either part is unusable — callers must skip it.
export function parseScheduleDateTime(dateValue, timeValue) {
  const day = parseScheduleDate(dateValue);
  if (!day) return null;

  // Strict parse: an empty or unrecognizable time is unusable, NOT 8am.
  const time = parseTimeStrict(timeValue);
  if (!time) return null;

  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  );
}

// Display helper (the dashboard's "Jun 26" label)
export const formatPickupLabel = (date) => {
  const label = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? label : `${label}, ${year}`;
};

/* ============================================================
 * IDENTIFIERS
 *
 * Deterministic, so a re-sync REPLACES an alarm instead of
 * stacking a duplicate on top of it. Sitio names contain spaces
 * and commas ("CAMANGGAHAN 1,2,3") which we strip for safety.
 * ============================================================ */

const slug = (value) => String(value).replace(/[^a-zA-Z0-9]/g, "");

export const reminderId = (scheduleId, sitio, offset) =>
  `coll_${slug(scheduleId)}_${slug(sitio)}_${offset}`;

/* ============================================================
 * DISPLAY HANDLER
 *
 * Required: without it, a notification that fires while the app is
 * in the foreground is silently swallowed.
 * (shouldShowAlert is deprecated in SDK 57 -> banner + list)
 * ============================================================ */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/* ============================================================
 * ANDROID CHANNEL
 *
 * Reminders must break through Doze, so the channel is MAX
 * importance with sound + vibration. Runs before any scheduling.
 * ============================================================ */
export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  try {
    await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
      name: NOTIF_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      sound: "default",
      lightColor: "#6B8E4E",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      bypassDnd: false,
      description: "Alerts before garbage collection in your sitio",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (error) {
    console.log("Error creating notification channel:", error);
  }
}

/* ============================================================
 * PERMISSION
 *
 * Returns true when reminders may be shown. Never throws — a
 * denied permission must not break the rest of the app.
 * ============================================================ */
// Guarded with a module-level promise: App.js's bootstrap and the login
// sync can both ask at the same moment, and stacked native permission
// dialogs resolve unpredictably. One shared request, one dialog.
let permissionRequest = null;

export function requestNotificationPermission() {
  if (permissionRequest) return permissionRequest;

  permissionRequest = (async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) {
        console.log("Notification permission denied permanently");
        return false;
      }
      const requested = await Notifications.requestPermissionsAsync();
      return !!requested.granted;
    } catch (error) {
      console.log("Error requesting notification permission:", error);
      return false;
    }
  })().finally(() => {
    permissionRequest = null;
  });

  return permissionRequest;
}

/* ============================================================
 * CANCELLATION
 * ============================================================ */

// Drops every locally-armed alarm. Used at the start of each sync
// (idempotency) and on logout / when mode === "server".
export async function cancelAllLocalReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.log("Error cancelling reminders:", error);
  }
}

// Drops only one schedule's alarms (on delete / completion).
export async function cancelRemindersForSchedule(scheduleId, sitio) {
  for (const offset of REMINDER_OFFSETS_MIN) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        reminderId(scheduleId, sitio, offset)
      );
    } catch (error) {
      // Identifier not scheduled — nothing to cancel.
    }
  }
}

/* ============================================================
 * SYNC — the core of the "device" delivery path
 *
 *  1. resolve mode      -> "server" means the phone stays quiet
 *  2. cancel everything -> makes the sync idempotent
 *  3. permission        -> bail gracefully if not granted
 *  4. scope             -> staff arm ALL sitios; residents only theirs;
 *                          residents with no sitio arm nothing
 *  5. arm T-10 / T-5    -> for each upcoming collection
 *
 * Returns a small result object so callers can log/test it.
 * ============================================================ */
// Two syncs can overlap (login + foreground, or a schedule save racing a
// sitio change). Unserialized, their cancel/arm steps interleave and the
// final alarm set depends on timing. Chaining them makes it deterministic:
// the LAST sync always wins. Deterministic IDs already prevent duplicates;
// this guarantees order too.
let syncChain = Promise.resolve();

export function syncCollectionReminders(user, userData) {
  const run = () => syncCollectionRemindersNow(user, userData);

  const result = syncChain.then(run, run);
  // Keep the chain alive even if this sync rejects.
  syncChain = result.then(
    () => {},
    () => {}
  );
  return result;
}

async function syncCollectionRemindersNow(user, userData) {
  const mode = resolveDeliveryMode();

  // Always clear first: no stale or duplicate alarms survive a sync.
  await cancelAllLocalReminders();

  // Server owns delivery now — the phone must NOT also fire.
  if (mode === DELIVERY_MODES.SERVER) return { mode, scheduled: 0 };
  if (!user || !userData) return { mode, scheduled: 0 };

  try {
    // REQUEST rather than merely check. On a first run the permission
    // dialog is often still open when the auth listener finishes, so a
    // plain check would bail and arm nothing for the whole session.
    // Awaiting the real answer closes that race.
    const granted = await requestNotificationPermission();
    if (!granted) return { mode, scheduled: 0, reason: "permission" };

    const staff = canViewAdminPanel(userData);
    const mySitio = normalizeSitio(userData.sitio);

    // Resident with no sitio -> nothing to remind them about.
    if (!staff && !mySitio) return { mode, scheduled: 0, reason: "no-sitio" };

    const snapshot = await db
      .collection("schedules")
      .where("type", "==", "collection")
      .where("status", "==", "scheduled")
      .get();

    const now = Date.now();
    const horizon = now + LOOKAHEAD_DAYS * 86400000;
    let scheduled = 0;

    for (const doc of snapshot.docs) {
      const schedule = doc.data();
      const when = parseScheduleDateTime(schedule.date, schedule.time);
      if (!when) continue;

      const at = when.getTime();
      if (at < now || at > horizon) continue;

      // Sitio gate: staff get every sitio, residents only their own.
      const sitio = String(schedule.sitio || "").trim();
      if (!staff && normalizeSitio(sitio) !== mySitio) continue;

      for (const offset of REMINDER_OFFSETS_MIN) {
        const fireAt = new Date(at - offset * 60000);
        if (fireAt.getTime() <= now) continue; // window already passed

        await Notifications.scheduleNotificationAsync({
          identifier: reminderId(doc.id, sitio, offset),
          content: {
            title: `Trash collection in ${offset} minutes`,
            body: `${sitio || "Your sitio"} · at ${formatTime(when)}`,
            sound: "default",
            color: "#6B8E4E",
            autoDismiss: true,
            data: {
              screen: "CollectionSchedule",
              scheduleId: doc.id,
              sitio,
              offset,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: NOTIF_CHANNEL_ID,
          },
        });
        scheduled += 1;
      }
    }

    console.log(`[reminders] ${mode}: armed ${scheduled} local alarm(s)`);
    return { mode, scheduled };
  } catch (error) {
    console.log("Error syncing collection reminders:", error);
    return { mode, scheduled: 0, error: true };
  }
}

/* ============================================================
 * TEST HELPER
 *
 * Fires one notification in `seconds` so we can prove the alarm
 * survives the app being killed (Phase 2 checkpoint).
 * ============================================================ */
export async function scheduleTestReminder(seconds = 60) {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: `test_${Date.now()}`,
    content: {
      title: `Test reminder in ${seconds}s`,
      body: "Kill the app now — this should still fire.",
      sound: "default",
      color: "#6B8E4E",
      data: { screen: "CollectionSchedule" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + seconds * 1000),
      channelId: NOTIF_CHANNEL_ID,
    },
  });
  return true;
}

/* ============================================================
 * BOOTSTRAP — called once from App.js on startup
 * ============================================================ */
export async function initNotifications() {
  configureNotificationHandler();
  await setupNotificationChannel();
  return requestNotificationPermission();
}
