// ============================================================
// shared/reminder-core.js
//
// PURE reminder logic shared by BOTH delivery paths:
//
//   the phone  ->  config/reminders.js  (local AlarmManager alarms)
//   the server ->  scripts/send-reminders.mjs (GitHub Actions -> Expo push)
//
// Nothing in this file may import React Native, Expo, or Firebase.
// That constraint is deliberate: it is what lets one Node script and
// one mobile bundle run byte-identical scheduling rules. If the two
// ever disagreed about WHEN a reminder is due, a resident in "server"
// mode could be notified while an identical resident in "device" mode
// was not — the exact double/missed-delivery failure this whole
// architecture exists to prevent.
//
// This folder carries its own package.json {"type":"module"} so Node
// loads it as ESM while Metro bundles it for the app unchanged.
// ============================================================ */

/** Android channel for collection reminders. */
export const NOTIF_CHANNEL_ID = "collection-reminders";
export const NOTIF_CHANNEL_NAME = "Collection Reminders";

/** Minutes before a collection that each reminder fires. */
export const REMINDER_OFFSETS_MIN = [10, 5];

/** How far ahead the phone arms alarms on every sync. */
export const LOOKAHEAD_DAYS = 14;

/**
 * How late a server-sent reminder may still be worth delivering.
 *
 * GitHub Actions cannot schedule more often than once every 5 minutes,
 * so a "10 minutes before" reminder is routinely 4 minutes late. Inside
 * this window we still send (a late heads-up beats none); outside it we
 * drop it, because warning someone that trash collection already began
 * is worse than saying nothing.
 */
export const CATCHUP_MINUTES = 5;

/**
 * Sitio comparison.
 *
 * Trims, collapses inner whitespace runs and lowercases. Firestore's
 * `where` is exact-match, so this is applied client/server-side instead.
 * Without it, "Buanoy Centro" vs "buanoy  centro " would silently deliver
 * to nobody — the worst possible failure mode for a reminder.
 *
 * Two sitio names can only collide if identical modulo spacing, which
 * means they are the same sitio, so this adds tolerance without risk.
 */
export const normalizeSitio = (value) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/* ============================================================
 * TIME PARSING  ("8:00 AM" <-> Date)
 * ============================================================ */

const withTime = (h, m) =>
  new Date(2000, 0, 1, Math.max(0, Math.min(23, h)), Math.max(0, Math.min(59, m)), 0, 0);

/**
 * STRICT — returns null when the value isn't a recognizable time.
 * The scheduler uses this: guessing 8:00 AM for a corrupt time would
 * fire a real resident's reminder at the wrong hour.
 */
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
  // Also require a digit: V8 happily reads a bare ":" or "" as midnight,
  // which would fire a resident's reminder at 12:00 AM.
  if (!/\d/.test(raw)) return null;

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

/** TOLERANT — never null. DISPLAY only, where 08:00 beats an empty field. */
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

/**
 * Handles Firestore Dates, "YYYY-MM-DD", "June 26", "Jun 26, 2026" and
 * anything else Date accepts. Schedules were originally free-text, so
 * all of these exist in the wild.
 */
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

/**
 * "2026-10-14" + "8:00 AM" -> Date(2026, 9, 14, 8, 0)
 * Returns null when either part is unusable — callers must skip it.
 */
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

/** The dashboard's "Jun 26" label (year only when it isn't this one). */
export const formatPickupLabel = (date) => {
  const label = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? label : `${label}, ${year}`;
};

/* ============================================================
 * IDENTIFIERS
 *
 * Deterministic, so a re-sync REPLACES an alarm instead of stacking a
 * duplicate. Sitio names contain spaces and commas ("CAMANGGAHAN 1,2,3")
 * which are stripped for safety.
 * ============================================================ */

const slug = (value) => String(value).replace(/[^a-zA-Z0-9]/g, "");

/** Identifier of a locally scheduled alarm. */
export const reminderId = (scheduleId, sitio, offset) =>
  `coll_${slug(scheduleId)}_${slug(sitio)}_${offset}`;

/** Firestore doc id used to dedupe a server-sent reminder. */
export const reminderDedupeId = (scheduleId, sitio, offset) =>
  `coll_${slug(scheduleId)}_${slug(sitio)}_${offset}`;

/* ============================================================
 * MESSAGING
 *
 * Both delivery paths build the SAME text. The countdown is computed
 * from the real remaining time rather than the nominal 10/5 tier, so a
 * reminder that GitHub Actions delivers 4 minutes late says "in about 6
 * minutes" — which is true — instead of a stale "in 10 minutes".
 * ============================================================ */

export const reminderMinutesUntil = (targetMs, nowMs) =>
  Math.max(1, Math.round((targetMs - nowMs) / 60000));

export function buildReminderMessage(collectionAtMs, sitio, minutesUntil) {
  return {
    title: `Trash collection in about ${minutesUntil} minute${
      minutesUntil === 1 ? "" : "s"
    }`,
    body: `${sitio || "Your sitio"} · at ${formatTime(new Date(collectionAtMs))}`,
  };
}

/* ============================================================
 * WHICH REMINDERS ARE DUE  (server catch-up logic)
 *
 * The cron runs at best every 5 minutes, so it cannot "fire" on the
 * minute — it must reconstruct what is due each run. Each reminder is
 * due once its fireAt has passed, and stays deliverable for
 * CATCHUP_MINUTES before being dropped as no longer useful.
 * ============================================================ */
export function collectDueReminders(schedules, now, options = {}) {
  const {
    offsets = REMINDER_OFFSETS_MIN,
    catchUpMinutes = CATCHUP_MINUTES,
  } = options;

  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const out = [];

  for (const schedule of schedules) {
    const when = parseScheduleDateTime(schedule.date, schedule.time);
    if (!when) continue;

    const at = when.getTime();
    if (at <= nowMs) continue; // collection already under way

    const sitio = String(schedule.sitio || "").trim();

    for (const offset of offsets) {
      const fireAt = at - offset * 60000;
      if (nowMs < fireAt) continue; // not due yet
      if (nowMs > fireAt + catchUpMinutes * 60000) continue; // too stale

      out.push({
        scheduleId: schedule.id,
        sitio,
        offset,
        collectionAt: at,
        fireAt,
        minutesUntil: reminderMinutesUntil(at, nowMs),
        dedupeId: reminderDedupeId(schedule.id, sitio, offset),
      });
    }
  }

  return out;
}
