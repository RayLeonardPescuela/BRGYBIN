// ============================================================
// config/receipt.js
//
// Redemption receipts. A resident redeems an item in
// RedeemRewards and gets a receipt they can view in-app and
// share as a PDF; admins read the same documents from the
// web portal's Receipts page.
//
// Receipt numbers are DERIVED, never stored in a counter:
//     RCP-2026-1A2B3C
// =   RCP-<year>-<first 6 alphanumeric chars of the doc ID,
//                 uppercased>
// Firestore auto-generated IDs are unique, so this can never
// race or collide, and the number stays attached to the doc
// wherever it travels. The year comes from the redemption date
// so it reads as the year the resident actually redeemed.
//
// New redemptions stamp `receiptNo` at write time (see
// RedeemRewards) so the number is frozen even if this format
// ever changes. Docs created before this feature existed have
// no `receiptNo` field — screens derive it with this same
// function at render time, so old and new always agree.
//
// `balanceAfter` is different: it is a point-in-time value
// that can only be computed at redeem time, so it is stamped
// on new docs and rendered as an em dash ("—") when missing.
// ============================================================ */

/**
 * Firestore reads timestamps back as Timestamp objects, which expose
 * .toDate(). Wrapping one in `new Date(...)` is an Invalid Date —
 * Timestamp.valueOf() returns a comparison string like
 * "063930135309.532000000", not milliseconds — so go through here
 * for any date field that might come from Firestore.
 */
export function toDate(value) {
  if (value && typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

/**
 * The receipt number for a redemption document.
 *
 * @param {string} docId - the redemptions document ID.
 * @param {*} createdAt - doc's createdAt (Timestamp, Date, or string).
 * @returns {string} e.g. "RCP-2026-1A2B3C".
 */
export function receiptNoFor(docId, createdAt) {
  const date = toDate(createdAt);
  const year = isNaN(date.getTime())
    ? new Date().getFullYear()
    : date.getFullYear();
  const suffix = String(docId)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  return `RCP-${year}-${suffix}`;
}
