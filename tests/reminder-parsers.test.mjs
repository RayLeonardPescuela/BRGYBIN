// Regression tests for the parser logic, re-run after it was MOVED from
// config/reminders.js into shared/reminder-core.js. The app and the
// server cron both depend on these, so a subtle change here would shift
// reminder timing for everyone silently.
import {
  parseTimeStrict,
  parseTimeToDate,
  formatTime,
  parseScheduleDate,
  parseScheduleDateTime,
  formatPickupLabel,
  normalizeSitio,
  reminderId,
  startOfToday,
} from "../shared/reminder-core.js";

let pass = 0, fail = 0;
const t = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++;
  else { fail++; console.log("FAIL " + label + "\n  got " + a + "\n  exp " + e); }
};
const hhmm = (d) => (d ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` : null);

// ================= parseTimeStrict =================
t("12h", hhmm(parseTimeStrict("8:00 AM")), "8:00");
t("12h no space", hhmm(parseTimeStrict("8AM")), "8:00");
t("12h single digit min", hhmm(parseTimeStrict("12:15pm")), "12:15");
t("12h dotted", hhmm(parseTimeStrict("8:00 A.M.")), "8:00");
t("12h midnight", hhmm(parseTimeStrict("12:00 AM")), "0:00");
t("12h noon", hhmm(parseTimeStrict("12:00 PM")), "12:00");
t("12h pm shift", hhmm(parseTimeStrict("1:30 PM")), "13:30");
t("24h", hhmm(parseTimeStrict("14:30")), "14:30");
t("24h padded", hhmm(parseTimeStrict("08:00")), "8:00");
t("24h midnight", hhmm(parseTimeStrict("00:00")), "0:00");
t("24h end of day", hhmm(parseTimeStrict("23:59")), "23:59");
t("hour only", hhmm(parseTimeStrict("8")), "8:00");
t("hour only 23", hhmm(parseTimeStrict("23")), "23:00");
t("whitespace tolerated", hhmm(parseTimeStrict("  8:00 AM  ")), "8:00");

// ---- the guards that prevent WRONG-TIME delivery ----
t("24:00 REJECTED (v8 rolls it to next day)", parseTimeStrict("24:00"), null);
t("24:01 rejected", parseTimeStrict("24:01"), null);
t("23:60 rejected", parseTimeStrict("23:60"), null);
t("minute 61 rejected", parseTimeStrict("8:61 AM"), null);
t("hour 99 rejected", parseTimeStrict("99:00"), null);
t("hour 25 rejected", parseTimeStrict("25"), null);
t("text rejected", parseTimeStrict("banana"), null);
t("empty rejected", parseTimeStrict(""), null);
t("whitespace-only rejected", parseTimeStrict("   "), null);
t("null rejected", parseTimeStrict(null), null);
t("undefined rejected", parseTimeStrict(undefined), null);
// Lenient single-digit minutes are acceptable and unambiguous: "8:0" is
// 8:00, "8:5" is 8:05. Still must not invent a value from pure text.
t("single-digit minutes read", hhmm(parseTimeStrict("8:0")), "8:00");
t("single-digit minutes 5", hhmm(parseTimeStrict("8:5")), "8:05");
t("bare colon rejected (v8 reads it as midnight)", parseTimeStrict(":"), null);
t("colon with space rejected", parseTimeStrict(" : "), null);
t("letters only rejected", parseTimeStrict("AM"), null);
t("letters only rejected 2", parseTimeStrict("noon"), null);
t("whitespace rejected", parseTimeStrict("  "), null);

// ================= parseTimeToDate (display only) =================
t("tolerant uses value", hhmm(parseTimeToDate("9:15 AM")), "9:15");
t("tolerant falls back to 8am", hhmm(parseTimeToDate("banana")), "8:00");
t("tolerant empty falls back", hhmm(parseTimeToDate("")), "8:00");
t("tolerant null falls back", hhmm(parseTimeToDate(null)), "8:00");
t("tolerant 24:00 falls back", hhmm(parseTimeToDate("24:00")), "8:00");

// ================= formatTime =================
const d = (h, m) => new Date(2026, 0, 1, h, m, 0, 0);
t("format AM", formatTime(d(8, 0)), "8:00 AM");
t("format PM", formatTime(d(13, 5)), "1:05 PM");
t("format midnight", formatTime(d(0, 0)), "12:00 AM");
t("format noon", formatTime(d(12, 0)), "12:00 PM");
t("format pads minutes", formatTime(d(9, 5)), "9:05 AM");
t("format null", formatTime(null), "");

// ================= parseScheduleDate =================
t("ISO", parseScheduleDate("2026-10-14").getTime(), new Date(2026, 9, 14).getTime());
t("ISO padded", parseScheduleDate("2026-01-05").getTime(), new Date(2026, 0, 5).getTime());
t("ISO with time", parseScheduleDate("2026-10-14T08:00:00").getTime(), new Date(2026, 9, 14).getTime());
t("Month name + year", parseScheduleDate("June 26, 2027").getTime(), new Date(2027, 5, 26).getTime());
t("Month abbrev", parseScheduleDate("Jun 26 2027").getTime(), new Date(2027, 5, 26).getTime());
t("Month dotted", parseScheduleDate("Jun. 26, 2027").getTime(), new Date(2027, 5, 26).getTime());
t("slash format", parseScheduleDate("10/14/2026").getTime(), new Date(2026, 9, 14).getTime());
t("empty -> null", parseScheduleDate(""), null);
t("null -> null", parseScheduleDate(null), null);
t("text -> null", parseScheduleDate("soon"), null);
// Firestore Timestamp-style object
const fakeTs = { toDate: () => new Date(2026, 9, 14) };
t("firestore Timestamp", parseScheduleDate(fakeTs).getTime(), new Date(2026, 9, 14).getTime());

// "June 26" with no year rolls FORWARD to next year once this year's
// occurrence has passed. Expectations are computed the same way so the
// test stays correct on any date it is run.
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const todayY = new Date().getFullYear();
const junY = new Date(todayY, 5, 26) < startOfToday() ? todayY + 1 : todayY;
t("Month name rolls forward when past", parseScheduleDate("June 26").getTime(), new Date(junY, 5, 26).getTime());

const soon = new Date();
soon.setDate(soon.getDate() + 30);
soon.setHours(0, 0, 0, 0);
const upcoming = parseScheduleDate(`${MONTHS_FULL[soon.getMonth()]} ${soon.getDate()}`);
t("Month name resolves to upcoming date", upcoming?.getTime(), soon.getTime());

// ================= parseScheduleDateTime =================
t("combined", parseScheduleDateTime("2026-10-14", "8:00 AM").getTime(), new Date(2026, 9, 14, 8, 0).getTime());
t("combined 24h", parseScheduleDateTime("2026-10-14", "14:30").getTime(), new Date(2026, 9, 14, 14, 30).getTime());
t("bad time -> null (NOT 8am)", parseScheduleDateTime("2026-10-14", "banana"), null);
t("empty time -> null (NOT 8am)", parseScheduleDateTime("2026-10-14", ""), null);
t("24:00 time -> null", parseScheduleDateTime("2026-10-14", "24:00"), null);
t("bad date -> null", parseScheduleDateTime("banana", "8:00 AM"), null);
t("no date -> null", parseScheduleDateTime(null, "8:00 AM"), null);

// ================= normalizeSitio =================
t("trims", normalizeSitio("  Buanoy Centro  "), "buanoy centro");
t("collapses DOUBLE inner space", normalizeSitio("buanoy  centro"), "buanoy centro");
t("collapses triple space", normalizeSitio("a   b    c"), "a b c");
t("lowercases", normalizeSitio("CAMANGGAHAN"), "camanggahan");
t("empty", normalizeSitio(""), "");
t("null", normalizeSitio(null), "");
t("undefined", normalizeSitio(undefined), "");
t("punctuation preserved", normalizeSitio("CAMANGGAHAN 1,2,3"), "camanggahan 1,2,3");
t("drift equality", normalizeSitio(" buanoy  CENTRO ") === normalizeSitio("Buanoy Centro"), true);

// ================= reminderId =================
t("id shape", reminderId("abc", "Buanoy Centro", 10), "coll_abc_BuanoyCentro_10");
t("id strips punctuation", reminderId("s/1", "A B,C", 5), "coll_s1_ABC_5");
t("id distinct offsets", reminderId("s", "A", 10) !== reminderId("s", "A", 5), true);
t("id distinct sitios", reminderId("s", "A", 10) !== reminderId("s", "B", 10), true);
t("id stable", reminderId("s", "A", 10) === reminderId("s", "A", 10), true);

// ================= formatPickupLabel =================
const thisYear = new Date(new Date().getFullYear(), 5, 26);
t("same year omits year", formatPickupLabel(thisYear), "Jun 26");
t("other year includes", formatPickupLabel(new Date(2027, 5, 26)), "Jun 26, 2027");
t("label month abbrev", formatPickupLabel(new Date(new Date().getFullYear(), 0, 9)), "Jan 9");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

