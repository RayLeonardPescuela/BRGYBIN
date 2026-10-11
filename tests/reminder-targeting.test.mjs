// Server-side targeting tests. Importing the script also proves that
// shared/package.json {"type":"module"} correctly lets Node load the
// shared core as ESM â€” the whole reason that file exists.
import { shouldReceive, chunk } from "../scripts/send-reminders.mjs";

let pass = 0, fail = 0;
const t = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++;
  else { fail++; console.log("FAIL " + label + "\n  got " + a + "\n  exp " + e); }
};

const device = { docId: "u1", uid: "u1", token: "ExpoPushToken:abc" };

const admin = { role: "admin", sitio: "Buanoy Centro" };
const collector = { role: "collector", sitio: "Camanggahan" };
const resident = { role: "user", sitio: "Buanoy Centro" };
const noSitio = { role: "user", sitio: "" };
const undefinedSitio = { role: "user" };

// ---- staff receive EVERY sitio regardless of their own ----
t("admin gets other sitio", shouldReceive(device, admin, "Camanggahan"), true);
t("admin gets own sitio", shouldReceive(device, admin, "Buanoy Centro"), true);
t("admin gets empty sitio sched", shouldReceive(device, admin, ""), true);
t("collector gets other sitio", shouldReceive(device, collector, "Buanoy Centro"), true);
t("collector gets own sitio", shouldReceive(device, collector, "Camanggahan"), true);

// ---- residents receive ONLY their own sitio ----
t("resident gets own", shouldReceive(device, resident, "Buanoy Centro"), true);
t("resident denied other", shouldReceive(device, resident, "Camanggahan"), false);
t("resident denied empty sitio sched", shouldReceive(device, resident, ""), false);

// ---- residents with no sitio get nothing (should set one) ----
t("empty sitio denied", shouldReceive(device, noSitio, "Buanoy Centro"), false);
t("undefined sitio denied", shouldReceive(device, undefinedSitio, "Buanoy Centro"), false);
t("undefined sitio vs empty sched", shouldReceive(device, undefinedSitio, ""), false);

// ---- drift tolerance: case + stray spaces must not drop delivery ----
t("case drift", shouldReceive(device, resident, "buanyo centro") === false, true);
t("case drift 2", shouldReceive(device, { role: "user", sitio: "buanoy  CENTRO" }, "Buanoy Centro"), true);
t("space drift", shouldReceive(device, { role: "user", sitio: " Buanoy  Centro " }, "Buanoy Centro"), true);
t("punct sitio drift", shouldReceive(device, { role: "user", sitio: "camanggahan 1,2,3" }, "CAMANGGAHAN 1,2,3"), true);

// ---- account removed since the token was stored ----
t("no user -> no send", shouldReceive(device, undefined, "Buanoy Centro"), false);
t("null user -> no send", shouldReceive(device, null, "Buanoy Centro"), false);

// ---- Expo batch limit = 100 ----
t("chunk 250", chunk(Array.from({ length: 250 }, (_, i) => i), 100).map(c => c.length), [100, 100, 50]);
t("chunk 100", chunk(Array.from({ length: 100 }, (_, i) => i), 100).map(c => c.length), [100]);
t("chunk 1", chunk([1], 100).map(c => c.length), [1]);
t("chunk 0", chunk([], 100).length, 0);
t("chunk preserves order", chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

