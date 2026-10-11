// Structural validation for firestore.rules, because no JVM/emulator is
// available in this environment to run the real compiler. This cannot
// prove semantic correctness, but it catches the failure that actually
// happens when hand-editing rules: an unbalanced brace silently nesting
// every later match block under the wrong parent.
import { readFileSync } from "node:fs";

const src = readFileSync("firestore.rules", "utf8");

let fail = 0;
const check = (label, ok, detail = "") => {
  if (ok) console.log("ok   " + label);
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

// ---- brace balance, ignoring comment content ----
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const count = (ch) => code.split(ch).length - 1;
check("brace balance", count("{") === count("}"), `${count("{")} open vs ${count("}")} close`);
check("paren balance", count("(") === count(")"), `${count("(")} vs ${count(")")}`);
check("no stray block-comment open", !code.includes("/*"));
check("no stray block-comment close", !code.includes("*/"));

// ---- required structure ----
check("single service block", count("service cloud.firestore {") === 1);
// Canonical Firebase forms: {database} variable (not the literal
// "(default)"), and rules_version using single quotes.
check("match /databases/{database}/documents present", code.includes("match /databases/{database}/documents"));
check("rules_version 2", /rules_version\s*=\s*['"]2['"]/.test(code));

// ---- each collection we touch from the app must be covered ----
const needed = [
  "users", "schedules", "pickupRequests", "complaints", "announcements",
  "notifications", "rewardItems", "redemptions", "pointHistory",
  "pushTokens", "reminderLog",
];
for (const c of needed) {
  check(`collection ${c}`, code.includes(`match /${c}/{`));
}

// ---- allow statements ----
const allows = src.match(/^\s*allow\s+[^;]+;/gm) || [];
console.log(`\n${allows.length} allow statement(s)`);

// ---- the push-token rule must be owner-scoped, not open ----
const pushBlock = code.slice(
  code.indexOf("match /pushTokens/{"),
  code.indexOf("match /reminderLog/{")
);
check("pushTokens owner-scoped", /request\.auth\.uid == userId/.test(pushBlock));
check("pushTokens has no wildcard allow", !/allow\s+[^;]*:\s*if\s+true/.test(pushBlock));

const logBlock = code.slice(
  code.indexOf("match /reminderLog/{"),
  code.indexOf("match /rewardItems/{")
);
check("reminderLog admin-only", /isAdmin\(\)/.test(logBlock) && !/isSignedIn\(\)/.test(logBlock));

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail ? 1 : 0);
