import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.("BloomFilterError")) return;
  originalConsoleError(...args);
};

const firebaseConfig = {
  apiKey: "AIzaSyBYU3-y1cJC489UD32CpSFcQUZ8qdzfHiQ",
  authDomain: "brngybindb.firebaseapp.com",
  projectId: "brngybindb",
  storageBucket: "brngybindb.appspot.com",
  messagingSenderId: "188250769398",
  appId: "1:188250769398:web:fd8c338141723a89bbe9d7",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
// Needed for arrayUnion/arrayRemove (e.g. per-user notification read state).
export const FieldValue = firebase.firestore.FieldValue;
export default firebase;
