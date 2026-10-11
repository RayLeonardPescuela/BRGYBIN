import React, { createContext, useState, useEffect, useContext } from "react";
import { AppState } from "react-native";
import { auth, db } from "../config/firebase";
import {
  syncCollectionReminders,
  cancelAllLocalReminders,
} from "./reminders";

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const doc = await db.collection("users").doc(firebaseUser.uid).get();
        if (doc.exists) {
          setUserData(doc.data());
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUserData = async () => {
    if (user) {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        setUserData(doc.data());
      }
    }
  };

  /* --------------------------------------------------------
   * REMINDER SYNC TRIGGERS
   *
   * Covers: login, logout, and any change to the two fields that
   * decide WHICH schedules this device arms (sitio + role).
   * A resident changing sitio re-arms against the new sitio;
   * logging out drops every alarm armed on this device.
   * -------------------------------------------------------- */
  useEffect(() => {
    if (loading) return;

    if (user && userData) {
      // Idempotent: syncCollectionReminders() cancel-alls first,
      // so calling it repeatedly never duplicates alarms.
      syncCollectionReminders(user, userData);
    } else if (!user) {
      cancelAllLocalReminders();
    }
  }, [loading, user, userData]);

  /* --------------------------------------------------------
   * FOREGROUND RESYNC
   *
   * This is what narrows device-mode's main gap: whenever the
   * resident re-opens the app, we re-arm 14 days ahead so any
   * schedule created since the last visit gets picked up.
   * -------------------------------------------------------- */
  useEffect(() => {
    if (!user || !userData) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncCollectionReminders(user, userData);
      }
    });

    return () => subscription.remove();
  }, [user, userData]);

  return (
    <UserContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
}
