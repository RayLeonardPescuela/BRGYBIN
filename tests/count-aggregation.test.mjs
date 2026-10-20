// Guards the dashboard counts against going back to downloading whole
// collections just to read `.size` off the result.
//
// A user doc can carry a ~900KB base64 avatar, so `db.collection("users")
// .get()` was pulling every account — avatars and all — over the network
// so the admin panel could render the digit "42". Same story for the
// complaints, the pending pickup requests and the redemption total.
//
// Firestore's server-side COUNT aggregation answers those with zero
// documents transferred. Nothing in the app *looks* broken if someone
// quietly reverts to `.get()` — the number still appears, just many
// megabytes later — so it needs a guard, exactly like the badge, the
// platform guards and the Metro alias do.
//
// It also pins the safety net: if aggregation is ever refused, the helper
// must still fall back to counting real documents rather than reporting
// 0 on a screen an admin is about to act on.
import { readFileSync, existsSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

// Body of a top-level `const name = async () => { ... };`, so assertions
// see only that function instead of bleeding into the next one.
const fnBody = (src, name) => {
  const start = src.indexOf(`const ${name} = `);
  if (start === -1) return "";
  const end = src.indexOf("\n  };", start);
  return end === -1 ? "" : src.slice(start, end);
};

// `db.collection("x").get()` with nothing in between — the pattern that
// downloads a whole collection. orderBy/limit/where in the middle means
// the read is bounded and does not match.
const bareCollectionGet = (path) =>
  new RegExp(`collection\\(\\s*["']${path}["']\\s*\\)\\s*\\.get\\(\\)`);

const counts = existsSync("config/counts.js") ? readFileSync("config/counts.js", "utf8") : "";
const adminHome = readFileSync("screens/AdminHome.js", "utf8");
const home = readFileSync("screens/Home.js", "utf8");
const complaints = readFileSync("screens/ViewComplaints.js", "utf8");
const points = readFileSync("screens/PointHistory.js", "utf8");

// ---- the helper really counts server-side ----
t("config/counts.js exists", counts.length > 0);
t("helper exports countDocs", /export async function countDocs\s*\(/.test(counts));
t("helper uses the COUNT aggregation", /getCountFromServer\(/.test(counts));
t("helper builds filtered queries with where()", /\bwhere\(field, op, value\)/.test(counts));
t("helper is wired to the same project as the app",
  /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*"\.\/firebase"/.test(counts));

// getFirestore() throws if no app exists yet, and config/firebase.js is
// what runs initializeApp(). Resolving it at module load would race the
// app's own init, so it must happen on first call instead.
t("helper imports ./firebase (initialises the app)", /from "\.\/firebase"/.test(counts));
t("helper resolves the modular db lazily", /function modularDb\(\)/.test(counts));

// ---- and never reports a made-up number if aggregation is refused ----
t("helper falls back to a real count", /return snapshot\.size;/.test(counts));
t("helper logs the fallback instead of failing silently",
  /aggregation unavailable/.test(counts));

// ---- AdminHome: numbers, not downloads ----
const statsBody = fnBody(adminHome, "fetchStats");
t("AdminHome counts users", /countDocs\("users"\)/.test(statsBody));
t("AdminHome counts complaints", /countDocs\("complaints"\)/.test(statsBody));
t("AdminHome counts pending complaints",
  /countDocs\("complaints",\s*\[\["status",\s*"==",\s*"pending"\]\]\)/.test(statsBody));
t("AdminHome counts pending requests",
  /countDocs\("pickupRequests",\s*\[\["status",\s*"==",\s*"pending"\]\]\)/.test(statsBody));
t("AdminHome does not download the users collection",
  !bareCollectionGet("users").test(statsBody));
t("AdminHome does not download the complaints collection",
  !bareCollectionGet("complaints").test(statsBody));
// The old pending total walked every complaint client-side.
t("AdminHome does not walk every complaint", !/docs\.forEach/.test(statsBody));
// Four round trips were being paid for one after another.
t("AdminHome asks for its stats in parallel", /Promise\.all\(/.test(statsBody));
t("AdminHome imports the helper", /import \{ countDocs \} from "\.\.\/config\/counts"/.test(adminHome));

// ---- Home: same, for the redemption total ----
const dashBody = fnBody(home, "fetchDashboardData");
t("Home counts redemptions", /countDocs\("redemptions"\)/.test(dashBody));
t("Home does not download the redemptions collection",
  !bareCollectionGet("redemptions").test(dashBody));
t("Home keeps the recent-activity read bounded",
  /\.limit\(\s*3\s*\)/.test(dashBody));
t("Home fetches its dashboard in parallel", /Promise\.all\(/.test(dashBody));
t("Home imports the helper", /import \{ countDocs \} from "\.\.\/config\/counts"/.test(home));

// ---- the two-list screens were paying for two round trips each ----
const complaintsBody = fnBody(complaints, "fetchAll");
t("ViewComplaints fetches its two lists together",
  /Promise\.all\(/.test(complaintsBody));
t("ViewComplaints still bounds itself to newest-first",
  /orderBy\("createdAt",\s*"desc"\)/.test(complaintsBody));

const pointsBody = fnBody(points, "fetchHistory");
t("PointHistory fetches earned and spent together",
  /Promise\.all\(/.test(pointsBody));
t("PointHistory keeps both halves newest-first",
  /orderBy\("createdAt",\s*"desc"\)/.test(pointsBody));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
