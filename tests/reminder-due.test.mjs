import {
  collectDueReminders,
  buildReminderMessage,
  reminderDedupeId,
  reminderMinutesUntil,
  normalizeSitio,
  parseScheduleDateTime,
  formatTime,
  REMINDER_OFFSETS_MIN,
  CATCHUP_MINUTES,
} from "../shared/reminder-core.js";

let pass = 0, fail = 0;
const t = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++;
  else { fail++; console.log("FAIL " + label + "\n  got " + a + "\n  exp " + e); }
};

// "Tomorrow" must be computed from LOCAL date parts. Using
// toISOString().slice(0, 10) would give the UTC date, which is the very
// timezone bug the production code has to avoid.
const pad = (n) => String(n).padStart(2, "0");
const localISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1); // DST/month safe
const tomorrow = localISO(tomorrowDate);

const [ty, tmo, tda] = tomorrow.split("-").map(Number);
// Wall-clock time ON THE COLLECTION DAY, built from local date parts.
// (new Date("YYYY-MM-DD") would parse as UTC midnight, reintroducing the
// exact timezone skew this whole feature has to avoid.)
const at = (h, m) => new Date(ty, tmo - 1, tda, h, m, 0, 0).getTime();

const sched = { id: "s1", type: "collection", status: "scheduled", sitio: "Buanoy Centro", date: tomorrow, time: "8:00 AM" };

console.log(`process tz offset: ${new Date().getTimezoneOffset()} min (TZ=${process.env.TZ || "unset"})`);

// ---- the collection clock is 8:00 AM tomorrow ----
t("schedule parses to 08:00", formatTime(parseScheduleDateTime(tomorrow, "8:00 AM")), "8:00 AM");

// ---- not yet due ----
t("T-10 not due at 7:45", collectDueReminders([sched], at(7, 45)).length, 0);
t("T-10 not due at 7:49", collectDueReminders([sched], at(7, 49)).length, 0);

// ---- due, on the minute ----
let due = collectDueReminders([sched], at(7, 50));
t("T-10 due at 7:50", due.length, 1);
t("T-10 offset", due[0]?.offset, 10);
t("T-10 minutesUntil", due[0]?.minutesUntil, 10);

due = collectDueReminders([sched], at(7, 51));
t("T-10 still due at 7:51 (1 min late)", due.length, 1);
t("T-10 minutesUntil honest", due[0]?.minutesUntil, 9);

// ---- cron jitter: 5-min runs land late, still deliverable ----
due = collectDueReminders([sched], at(7, 54));
t("T-10 due at 7:54 (4 min late, inside catchup)", due.length, 1);
t("minutesUntil reflects real remaining", due[0]?.minutesUntil, 6);

// ---- boundary: exactly CATCHUP_MINUTES late is still sent ----
// At 7:55 two things are true at once: the T-10 reminder is exactly on
// its catch-up edge, AND the T-5 reminder has just become due. Count
// each tier separately rather than the total.
const byOffset = (list, off) => list.filter((d) => d.offset === off);
due = collectDueReminders([sched], at(7, 55));
t("T-10 due at exactly catchup edge", byOffset(due, 10).length, 1);
t("T-5 also due at 7:55", byOffset(due, 5).length, 1);

// ---- one minute past catchup: dropped as no longer useful ----
due = collectDueReminders([sched], at(7, 56));
t("T-10 dropped past catchup", byOffset(due, 10).length, 0);
t("T-5 still due at 7:56", byOffset(due, 5).length, 1);

// ---- the 5-minute tier ----
due = collectDueReminders([sched], at(7, 55));
t("T-5 offset", byOffset(due, 5)[0]?.offset, 5);

due = collectDueReminders([sched], at(7, 57));
t("both tiers overdue window", due.filter(d => d.offset === 5).length, 1);

// ---- collection already under way: never send ----
t("nothing at 8:01", collectDueReminders([sched], at(8, 1)).length, 0);
t("nothing at 9:00", collectDueReminders([sched], at(9, 0)).length, 0);

// ---- unusable schedules are skipped, never guessed ----
t("bad time skipped", collectDueReminders([{ ...sched, time: "banana" }], at(7, 50)).length, 0);
t("no time skipped", collectDueReminders([{ ...sched, time: "" }], at(7, 50)).length, 0);
t("bad date skipped", collectDueReminders([{ ...sched, date: "nope" }], at(7, 50)).length, 0);

// ---- dedupe ids are stable and distinct where they must be ----
t("dedupe stable", reminderDedupeId("s1", "Buanoy Centro", 10) === reminderDedupeId("s1", "Buanoy Centro", 10), true);
t("dedupe distinct offsets", reminderDedupeId("s1", "S", 10) !== reminderDedupeId("s1", "S", 5), true);
t("dedupe distinct sitios", reminderDedupeId("s1", "A", 10) !== reminderDedupeId("s1", "B", 10), true);
t("dedupe strips punctuation", reminderDedupeId("s1", "CAMANGGAHAN 1,2,3", 5), "coll_s1_CAMANGGAHAN123_5");

// ---- messaging is honest about the real countdown ----
t("title 10", buildReminderMessage(at(8, 0), "Buanoy Centro", 10).title, "Trash collection in about 10 minutes");
t("title 1", buildReminderMessage(at(8, 0), "Buanoy Centro", 1).title, "Trash collection in about 1 minute");
t("body", buildReminderMessage(at(8, 0), "Buanoy Centro", 10).body, "Buanoy Centro \u00b7 at 8:00 AM");
t("minutesUntil floor of 1", reminderMinutesUntil(at(8, 0), at(8, 5)), 1);

// ---- sitio normalisation ----
t("drift", normalizeSitio(" buanoy  CENTRO ") === normalizeSitio("Buanoy Centro"), true);

// ---- multiple schedules across sitios ----
const two = [
  { ...sched, id: "s1", sitio: "Buanoy Centro" },
  { ...sched, id: "s2", sitio: "CAMANGGAHAN 1,2,3", time: "6:00 AM" },
];
const d2 = collectDueReminders(two, at(7, 50));
t("two schedules, one due", d2.length, 1);
t("due one is the 8am", d2[0]?.scheduleId, "s1");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

