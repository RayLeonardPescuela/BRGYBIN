// ============================================================
// scripts/send-reminders.mjs
//
// The "server" delivery path. Runs on a GitHub Actions cron, decides
// which collection reminders are due right now, and sends them through
// the Expo Push Service (which delivers over FCM on Android).
//
// WHY THIS EXISTS: local alarms only arm once the resident opens the
// app. Anyone who installs the app and never reopens it would otherwise
// never be warned. This path reaches them regardless.
//
// COST: $0. GitHub Actions is free for public repos, the Expo push
// service is free and unmetered, and service accounts are free on the
// Firebase Spark plan. No Cloud Functions, so no Blaze plan needed.
//
// IDEMPOTENCY: GitHub cannot schedule more often than every 5 minutes,
// so this script must reconstruct "what is due" on each run rather than
// fire on the minute. Each reminder is claimed by creating a doc in
// `reminderLog` with a deterministic id; if that create fails the
// reminder was already sent in a previous run and is skipped. If the
// send itself fails, the claims are rolled back so the next run retries.
//
// USAGE:
//   FIREBASE_SERVICE_ACCOUNT='{"project_id":...}' node scripts/send-reminders.mjs
//   node scripts/send-reminders.mjs --dry-run     (compute, send nothing)
//
// TIMEZONE: collections are stored as a local date + time ("2026-10-14"
// + "8:00 AM"). A GitHub runner is UTC, so without the TZ env var set in
// the workflow every reminder would fire hours late. Set TZ there.
// ============================================================ */

import admin from "firebase-admin";
import { pathToFileURL } from "node:url";
import {
  collectDueReminders,
  buildReminderMessage,
  normalizeSitio,
  NOTIF_CHANNEL_ID,
} from "../shared/reminder-core.js";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "brngybindb";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_LIMIT = 100;

const STAFF_ROLES = new Set(["admin", "collector"]);

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
      projectId: PROJECT_ID,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({ projectId: PROJECT_ID });
  }

  throw new Error(
    "Missing credentials. Set FIREBASE_SERVICE_ACCOUNT to the service account " +
      "JSON, or GOOGLE_APPLICATION_CREDENTIALS to a key file path."
  );
}

/**
 * Who should receive a reminder for a given sitio.
 *
 * Mirrors the phone-side scope exactly: staff are notified about every
 * sitio, a resident only about their own, and a resident with no sitio
 * about nothing (they should set one).
 */
export function shouldReceive(device, user, scheduleSitio) {
  if (!user) return false; // account removed since the token was stored
  if (STAFF_ROLES.has(user.role)) return true;

  const mine = normalizeSitio(user.sitio);
  if (!mine) return false;

  return normalizeSitio(scheduleSitio) === mine;
}

/** Expo accepts up to 100 messages per request. */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function sendToExpo(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    throw new Error(`Expo push service returned HTTP ${res.status}`);
  }

  return (await res.json()).data || [];
}

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

  initFirebase();
  const db = admin.firestore();

  const now = new Date();
  console.log(
    `[send-reminders] start (tz=${process.env.TZ || "system"}, dryRun=${dryRun})`
  );

  // ---- 1. upcoming collection schedules -------------------------------
  const schedSnap = await db
    .collection("schedules")
    .where("type", "==", "collection")
    .where("status", "==", "scheduled")
    .get();

  // collectDueReminders() does the date filtering itself: it skips
  // anything already under way, anything not yet due, and anything too
  // stale to be worth sending.
  const schedules = schedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const due = collectDueReminders(schedules, now);
  if (due.length === 0) {
    console.log("[send-reminders] nothing due");
    return;
  }
  console.log(`[send-reminders] ${due.length} reminder instance(s) due`);

  // ---- 2. registered devices + accounts -------------------------------
  const [tokenSnap, userSnap] = await Promise.all([
    db.collection("pushTokens").get(),
    db.collection("users").get(),
  ]);

  const devices = tokenSnap.docs
    .map((d) => ({ docId: d.id, ...d.data() }))
    .filter((d) => d.token);

  const usersById = new Map(
    userSnap.docs.map((d) => [d.id, d.data()])
  );

  if (devices.length === 0) {
    console.log(
      "[send-reminders] no devices have registered a push token; nothing to send"
    );
    return;
  }
  console.log(`[send-reminders] ${devices.length} registered device(s)`);

  // ---- 3. claim each reminder, then build its messages ----------------
  const claimed = []; // log docs created this run (rolled back on failure)
  const messages = [];
  let skippedDuplicates = 0;
  let skippedNoTarget = 0;

  for (const reminder of due) {
    const logRef = db.collection("reminderLog").doc(reminder.dedupeId);

    if (!dryRun) {
      try {
        // Atomic claim: create fails if a previous run already sent this
        // exact (schedule, sitio, offset) reminder.
        await logRef.create({
          scheduleId: reminder.scheduleId,
          sitio: reminder.sitio,
          offset: reminder.offset,
          fireAt: reminder.fireAt,
          collectionAt: reminder.collectionAt,
          status: "pending",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        claimed.push(logRef);
      } catch (error) {
        if (error.code === 6 || /already exists/i.test(error.message || "")) {
          skippedDuplicates += 1;
          continue;
        }
        throw error;
      }
    }

    const { title, body } = buildReminderMessage(
      reminder.collectionAt,
      reminder.sitio,
      reminder.minutesUntil
    );

    const targets = devices.filter((device) =>
      shouldReceive(device, usersById.get(device.uid), reminder.sitio)
    );

    if (targets.length === 0) {
      skippedNoTarget += 1;
      continue;
    }

    for (const device of targets) {
      messages.push({
        to: device.token,
        sound: "default",
        title,
        body,
        channelId: NOTIF_CHANNEL_ID,
        data: {
          screen: "CollectionSchedule",
          scheduleId: reminder.scheduleId,
          sitio: reminder.sitio,
          offset: reminder.offset,
        },
      });
    }
  }

  console.log(
    `[send-reminders] ${messages.length} message(s) to send ` +
      `(${skippedDuplicates} already sent, ${skippedNoTarget} with no matching device)`
  );

  if (dryRun) {
    for (const m of messages) console.log(`  -> ${m.title} | ${m.body}`);
    console.log("[send-reminders] dry run: nothing sent, no claims made");
    return;
  }

  if (messages.length === 0) {
    console.log("[send-reminders] done (nothing to send)");
    return;
  }

  // ---- 4. send, and roll back the claims if we could not --------------
  try {
    const tokenDocIds = new Map(devices.map((d) => [d.token, d.docId]));
    let ok = 0;
    let failed = 0;
    let pruned = 0;

    for (const batch of chunk(messages, EXPO_BATCH_LIMIT)) {
      const results = await sendToExpo(batch);

      for (let i = 0; i < batch.length; i++) {
        const result = results[i] || { status: "error", message: "missing receipt" };

        if (result.status === "ok") {
          ok += 1;
          continue;
        }

        failed += 1;
        console.warn(
          `[send-reminders] ${result.status}: ${result.message || result.details?.error || "unknown"}`
        );

        // A device that has uninstalled the app: drop the token so we
        // stop targeting it on every future run.
        if (result.details?.error === "DeviceNotRegistered") {
          const docId = tokenDocIds.get(batch[i].to);
          if (docId) {
            await db.collection("pushTokens").doc(docId).delete().catch(() => {});
            pruned += 1;
          }
        }
      }
    }

    // Mark the claims complete now that delivery was accepted.
    if (claimed.length > 0) {
      const batchWriter = db.batch();
      for (const logRef of claimed) batchWriter.update(logRef, { status: "sent" });
      await batchWriter.commit().catch(() => {});
    }

    console.log(`[send-reminders] done: ${ok} sent, ${failed} failed, ${pruned} token(s) pruned`);
  } catch (error) {
    // Release the claims so the next cron run retries instead of
    // treating these reminders as already delivered.
    console.error("[send-reminders] send failed, releasing claims:", error?.message || error);
    if (claimed.length > 0) {
      const rollback = db.batch();
      for (const logRef of claimed) rollback.delete(logRef);
      await rollback.commit().catch(() => {});
    }
    process.exitCode = 1;
  }
}

// Only run when invoked directly. Importing this module (as the tests
// do) must not fire off a send.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error("[send-reminders] fatal:", error?.stack || error);
    process.exitCode = 1;
  });
}
