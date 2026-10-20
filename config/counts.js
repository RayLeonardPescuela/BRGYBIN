// ============================================================
// config/counts.js
//
// Counting documents WITHOUT downloading them.
//
// A few screens only need a NUMBER — "how many users", "how many
// complaints", "how many scans" — but the compat API made them ask the
// only way it offers: fetch every document and read `.size`.
//
// That is brutally wasteful here. A user doc can carry a ~900KB base64
// avatar, so the admin dashboard was pulling every account over the
// network, avatars and all, just to render the digit "42".
//
// Firestore has a server-side COUNT aggregation for exactly this: the
// number comes back and zero documents are transferred. This module
// wraps it, with the old download-and-count kept as a safety net so a
// screen can never show a wrong number just because aggregation was
// refused.
// ============================================================ */

import {
  getFirestore,
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
// Imported for its side effect as much as for `db`: it is what runs
// `initializeApp()`, so there is a default app to count against.
import { db } from "./firebase";

// The compat layer registers the default app through the modular SDK, so
// `getFirestore()` resolves to the very same Firestore `db` already
// points at — same project, same security rules. Resolved lazily on
// first use, never at module load, so app init always happens first.
let sharedDb = null;
function modularDb() {
  if (!sharedDb) sharedDb = getFirestore();
  return sharedDb;
}

/**
 * How many documents are in a collection, optionally narrowed by
 * filters.
 *
 * @param {string} path   collection path, e.g. "complaints"
 * @param {Array} [filters] triples in `where()` order:
 *                         [["status", "==", "pending"]]
 * @returns {Promise<number>}
 *
 * @example
 *   await countDocs("users");                                  // every user
 *   await countDocs("complaints", [["status", "==", "pending"]]);
 */
export async function countDocs(path, filters = []) {
  // Fast path: a server-side aggregation. One tiny response, no docs.
  try {
    const constraints = filters.map(([field, op, value]) => where(field, op, value));
    const snapshot = await getCountFromServer(
      query(collection(modularDb(), path), ...constraints)
    );
    return snapshot.data().count;
  } catch (error) {
    // Never fatal. If aggregation is refused (rules, offline, an older
    // runtime) fall back to the old way rather than reporting 0.
    console.log(`countDocs("${path}") aggregation unavailable, downloading instead:`, error);
  }

  // Slow path: same answer, but it pays for a full download.
  let ref = db.collection(path);
  for (const [field, op, value] of filters) ref = ref.where(field, op, value);
  const snapshot = await ref.get();
  return snapshot.size;
}
