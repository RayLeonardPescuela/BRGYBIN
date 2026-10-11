// ============================================================
// config/reminders.js — reminder delivery (the phone's side)
//
// The actual scheduling RULES (offsets, date/time parsing, sitio
// matching, which reminders are due) live in shared/reminder-core.js so
// this file and the server cron in scripts/send-reminders.mjs run
// identical logic. Everything here is the React Native / Expo half:
// permissions, channels, local alarms and push-token registration.
//
// DELIVERY MODES — exactly ONE owns delivery per device, so a resident
// never receives the same reminder twice:
//
//   "device" -> this phone arms its own T-10 / T-5 alarms
//               (fires with the app killed and offline; needs one
//                app-open to arm them)
//   "server" -> GitHub Actions cron sends via the Expo Push Service
//               (fires even if the app was never opened)
//
// SHIPPING DEFAULT IS "device". Flip it only once the Phase 4 setup is
// complete AND you have confirmed a real device registered a push token
// (DeveloperKiosk shows this). Flipping early is safe rather than
// silent: syncCollectionReminders() falls back to local alarms whenever
// this device has no usable push token.
// ============================================================

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { auth, db } from "./firebase";
import { canViewAdminPanel } from "./roles";

// All pure scheduling logic is shared with the server. Re-exported here
// so existing app imports keep working from one place.
export * from "../shared/reminder-core";

import {
  REMINDER_OFFSETS_MIN,
  NOTIF_CHANNEL_ID,
  normalizeSitio,
  parseScheduleDateTime,
  reminderId,
  reminderMinutesUntil,
  buildReminderMessage,
} from "../shared/reminder-core";

export const DELIVERY_MODES = {
  SERVER: "server",
  DEVICE: "device",
};

/* ============================================================
 * DELIVERY RESOLVER — the single if/else
 *
 * The ONLY place in the app that decides which mode is configured.
 * ============================================================ */
export function resolveDeliveryMode() {
  return DELIVERY_MODES.DEVICE;
}

/* ============================================================
 * PUSH TOKEN
 *
 * Push notifications are unavailable in Expo Go on Android from SDK 53,
 * so this only succeeds inside a development/EAS build. Tracking the
 * result lets the sync fall back to local alarms instead of quietly
 * delivering nothing.
 * ============================================================ */

let pushTokenState = { ok: false, token: null };

/** True once this device has confirmed it can receive a push. */
export function hasPushToken() {
  return pushTokenState.ok;
}

export function getPushToken() {
  return pushTokenState.token;
}

export async function registerPushToken(user, userData) {
  pushTokenState = { ok: false, token: null };
  if (!user?.uid) return null;

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log("[reminders] no EAS projectId configured; push unavailable");
      return null;
    }

    // Android 13+ requires a channel to exist before the OS will even
    // show the permission prompt, and the prompt must be answered
    // before a token can be issued.
    await setupNotificationChannel();
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.log("[reminders] notification permission denied; no push token");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    pushTokenState = { ok: true, token };

    // One doc per user. The cron reads this collection to decide who to
    // notify, and can match on sitio/role without extra reads.
    await db.collection("pushTokens").doc(user.uid).set(
      {
        token,
        uid: user.uid,
        role: userData?.role || "user",
        sitio: userData?.sitio || "",
        platform: Platform.OS,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    console.log("[reminders] push token registered");
    return token;
  } catch (error) {
    console.log(
      "[reminders] push token registration failed:",
      error?.message || error
    );
    return null;
  }
}

export async function unregisterPushToken(user) {
  pushTokenState = { ok: false, token: null };
  if (!user?.uid) return;

  try {
    await db.collection("pushTokens").doc(user.uid).delete();
  } catch (error) {
    // Sign-out ordering can reject this write. A leftover token is
    // harmless: the push service returns DeviceNotRegistered and the
    // cron prunes it.
  }
}

/**
 * Use this instead of auth.signOut() everywhere.
 *
 * The push token MUST be dropped while the user is still signed in — the
 * pushTokens rule only lets the owner delete their own doc. Skipping this
 * leaves a stale token behind, and on a shared phone the next account
 * would then receive BOTH its own reminders and the previous account's,
 * because both docs point at the same device token.
 *
 * The delete is kicked off before signOut so the request carries valid
 * credentials, and is deliberately not awaited: a slow network must never
 * stall signing out, and the SDK finishes the in-flight write on its own.
 */
export function signOutAndCleanup() {
  unregisterPushToken(auth.currentUser).catch(() => {});
  return auth.signOut();
}

/* ============================================================
 * DISPLAY HANDLER
 *
 * Required: without it, a notification that fires while the app is in
 * the foreground is silently swallowed.
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
 * Reminders must break through Doze, so the channel is MAX importance
 * with sound + vibration.
 * ============================================================ */
export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  try {
    await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
      name: "Collection Reminders",
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
 * Guarded with a module-level promise: App.js's bootstrap and the login
 * sync can both ask at the same moment, and stacked native permission
 * dialogs resolve unpredictably. One shared request, one dialog.
 * ============================================================ */
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
// (idempotency) and on logout / when the server owns delivery.
export async function cancelAllLocalReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.log("Error cancelling reminders:", error);
  }
}

// Drops only one schedule's alarms (on delete).
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
 * SYNC — the "device" delivery path
 *
 *  1. resolve mode  -> if the server owns delivery AND this device can
 *                      receive push, the phone stays quiet
 *  2. cancel all    -> makes the sync idempotent
 *  3. permission    -> bail gracefully if not granted
 *  4. scope         -> staff arm ALL sitios; residents only their own;
 *                      residents with no sitio arm nothing
 *  5. arm T-10/T-5  -> for each upcoming collection
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
  const configured = resolveDeliveryMode();

  // Always clear first: no stale or duplicate alarms survive a sync.
  await cancelAllLocalReminders();

  if (configured === DELIVERY_MODES.SERVER && hasPushToken()) {
    // The cron owns delivery for this device. Arming local alarms too
    // would deliver every reminder twice.
    return { mode: DELIVERY_MODES.SERVER, scheduled: 0, reason: "server" };
  }

  if (configured === DELIVERY_MODES.SERVER) {
    // Mode is flipped but push is not actually working here (Expo Go, or
    // registration failed). Falling back means flipping the flag can
    // never leave a resident with NO reminders.
    console.log(
      "[reminders] server mode configured but no push token on this device; arming local alarms"
    );
  }

  const mode = DELIVERY_MODES.DEVICE;
  if (!user || !userData) return { mode, scheduled: 0 };

  try {
    // REQUEST rather than merely check. On a first run the permission
    // dialog is often still open when the auth listener finishes, so a
    // plain check would bail and arm nothing for the whole session.
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
    const horizon = now + 14 * 86400000;
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

        // Identical wording to what the server sends.
        const message = buildReminderMessage(
          at,
          sitio,
          reminderMinutesUntil(at, fireAt.getTime())
        );

        await Notifications.scheduleNotificationAsync({
          identifier: reminderId(doc.id, sitio, offset),
          content: {
            title: message.title,
            body: message.body,
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
 * TEST HELPER — fires one notification in `seconds` so we can prove
 * the alarm survives the app being killed.
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
