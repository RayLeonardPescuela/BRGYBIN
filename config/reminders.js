// ============================================================
// config/reminders.js — collection reminder notifications
//
// PHASE 1 (this file):     channel + permission + display handler
// PHASE 2 (next):          syncCollectionReminders() / cancelAll()
// PHASE 4 (GitHub Actions): the "server" push path
//
// DELIVERY MODES — exactly ONE owns delivery, so a resident
// never receives the same reminder twice:
//
//   "device" -> this phone schedules its own T-10 / T-5 alarms
//               (works with the app killed & offline; needs one
//                app-open to arm them)
//   "server" -> GitHub Actions cron sends via FCM
//               (works even if the app was never opened)
// ============================================================

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ---------- constants ----------

export const NOTIF_CHANNEL_ID = "collection-reminders";
export const NOTIF_CHANNEL_NAME = "Collection Reminders";

// Minutes before the collection time. Both offsets are used by
// the local scheduler AND by the server-side cron.
export const REMINDER_OFFSETS_MIN = [10, 5];

export const DELIVERY_MODES = {
  SERVER: "server",
  DEVICE: "device",
};

// ---------- delivery resolver (the if/else) ----------
// Phase 4 flips this to SERVER once push tokens are registered and
// the GitHub Actions workflow is enabled. Single source of truth —
// nothing else in the app decides which mode is active.
export function resolveDeliveryMode() {
  return DELIVERY_MODES.DEVICE;
}

// ---------- display handler ----------
// Required: without this, notifications that fire while the app is
// in the foreground are silently swallowed.
// (shouldShowAlert is deprecated in SDK 57 -> use banner + list)
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

// ---------- Android channel ----------
// Reminders must break through Doze, so the channel is MAX importance
// with sound + vibration. Must run before any notification is scheduled.
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

// ---------- permission ----------
// Returns true when reminders may be shown. Never throws — a denied
// permission must not break the rest of the app.
export async function requestNotificationPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();

    if (current.granted) return true;
    if (!current.canAskAgain) {
      // User denied permanently -> they must enable it in Settings.
      console.log("Notification permission denied permanently");
      return false;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return !!requested.granted;
  } catch (error) {
    console.log("Error requesting notification permission:", error);
    return false;
  }
}

// ---------- one-shot bootstrap ----------
// Called once from App.js on startup.
export async function initNotifications() {
  configureNotificationHandler();
  await setupNotificationChannel();
  return requestNotificationPermission();
}
