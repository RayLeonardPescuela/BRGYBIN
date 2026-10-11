// Guards the profile photo upload against the bug that made saving a
// photo silently produce an empty avatar.
//
// The old path fetched the picked image's file:// URI into a Blob and ran
// FileReader.readAsDataURL over it. React Native does not reliably
// implement that, so it yielded a malformed data URL: <Image> rendered its
// border ring with nothing inside, and the garbage value written to
// Firestore meant the avatar vanished again on the next reload.
//
// expo-image-picker can decode to base64 natively. These assertions force
// the picker-provided string to be the only path, and make sure the
// round trip through Blob / FileReader can never come back.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("ok   " + label); }
  else { fail++; console.log("FAIL " + label + (detail ? " -> " + detail : "")); }
};

const src = readFileSync("screens/profile.js", "utf8");

// Strip comments first. The rationale for this fix is documented inline,
// and it necessarily names FileReader / readAsDataURL / Blob — matching
// prose would make these assertions meaningless. They must read code.
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// ---- the broken path must stay gone ----
t("no fetch() of the picked file URI", !/fetch\(\s*pendingImage\s*\)/.test(code));
t("no Blob round trip", !/response\.blob\(\)/.test(code));
t("no FileReader", !/FileReader/.test(code));
t("no readAsDataURL", !/readAsDataURL/.test(code));

// ---- and the native base64 path must be present ----
t("picker requests base64 natively", /base64:\s*true/.test(code));
t("picker result stores raw base64", /setPendingBase64\(/.test(code));
t("picker result stores the mime type", /setPendingMime\(/.test(code));
t("save builds the data URL from picker base64",
  /data:\$\{pendingMime\};base64,\$\{pendingBase64\}/.test(code));

// ---- state hygiene ----
// Dropping the base64 on cancel and after save is what stops a stale
// photo from being re-written the next time the user taps save.
t("cancel clears the pending base64", /cancelPendingPhoto[\s\S]{0,120}setPendingBase64\(null\)/.test(code));
t("successful save clears the pending base64",
  /setProfileImage\(base64\)[\s\S]{0,120}setPendingBase64\(null\)/.test(code));

// ---- failure is surfaced, not swallowed ----
t("missing base64 is reported to the user", /Could not read photo/.test(code));

// ---- Firestore's 1 MiB document ceiling ----
// The photo shares the user doc with name, email, points and sitio, so an
// oversized base64 string would make the whole update get rejected.
t("oversized photo is rejected before writing", /Photo too large/.test(code));
t("size ceiling is defined", /MAX_PHOTO_CHARS\s*=\s*[\d\s*]+/.test(code));
t("ceiling stays under Firestore's 1 MiB doc limit", /900\s*\*\s*1024/.test(code));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
