import React, { useEffect, useRef, useState } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { auth, db } from "../config/firebase";
import { canViewAdminPanel } from "../config/roles";
import shared, { COLORS } from "../styles";

// Seconds the Resend button is locked after firing, so it can't be spammed.
const RESEND_COOLDOWN = 60;

/**
 * Email verification (Firebase link).
 *
 * Reached after an email/password sign-up, and from Login when the account
 * is not yet verified. Google users never land here — Google verifies for us.
 *
 * The flow: we emailed a link to the address below; the user clicks it in
 * their inbox, then taps Continue. We reload the user and check emailVerified.
 */
export default function VerifyEmail() {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || auth.currentUser?.email || "your email";

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const timerRef = useRef(null);

  // Clean up the cooldown interval on unmount.
  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    const user = auth.currentUser;
    if (!user) {
      navigation.navigate("Login");
      return;
    }
    setResending(true);
    setMessage("");
    try {
      await user.sendEmailVerification();
      setMessage("Verification link sent again. Check your inbox and spam folder.");
      startCooldown();
    } catch (err) {
      console.log("Resend verification error:", err.code, err.message);
      if (err.code === "auth/too-many-requests") {
        setMessage("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        setMessage("Couldn't send the email. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleContinue = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigation.navigate("Login");
      return;
    }
    setChecking(true);
    setMessage("");
    try {
      await user.reload();
      const refreshed = auth.currentUser;
      if (refreshed && refreshed.emailVerified) {
        const doc = await db.collection("users").doc(refreshed.uid).get();
        const userData = doc.data();
        navigation.navigate(canViewAdminPanel(userData) ? "AdminHome" : "Home");
      } else {
        setMessage("Not verified yet — open the link we emailed you, then tap Continue.");
      }
    } catch (err) {
      console.log("Verify check error:", err);
      setMessage("Couldn't check your verification status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Email</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.content}>
        <MaterialCommunityIcons
          name="email-check-outline"
          size={90}
          color={COLORS.primary}
        />
        <Text style={styles.title}>Check your inbox</Text>

        <Text style={styles.subtitle}>We sent a verification link to</Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.hint}>
          Open the link in that email, then tap Continue below. Didn't get it? Check
          your spam folder, or resend it.
        </Text>

        {message ? (
          <View style={styles.messageBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={COLORS.accent}
            />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.continueBtn, checking && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.continueText}>I've verified — Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendBtn, cooldown > 0 && { opacity: 0.6 }]}
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
        >
          {resending ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Text style={styles.resendText}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.backLinkText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.textDark,
    marginTop: 15,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "sans-serif",
    color: COLORS.textSecondary,
    marginTop: 15,
    textAlign: "center",
  },
  email: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.primary,
    marginTop: 4,
    textAlign: "center",
  },
  hint: {
    fontSize: 14,
    fontFamily: "sans-serif",
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 15,
    lineHeight: 20,
  },
  messageBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "sans-serif",
    color: COLORS.textPrimary,
  },
  continueBtn: {
    backgroundColor: COLORS.primary,
    width: "100%",
    paddingVertical: 15,
    borderRadius: 35,
    alignItems: "center",
    elevation: 4,
    marginTop: 25,
  },
  continueText: {
    fontSize: 18,
    color: COLORS.white,
    fontFamily: "sans-serif",
    fontWeight: "bold",
  },
  resendBtn: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  resendText: {
    fontSize: 15,
    fontFamily: "sans-serif",
    color: COLORS.accent,
    fontWeight: "600",
  },
  backLink: {
    marginTop: 14,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: "sans-serif",
    color: COLORS.textDark,
    textDecorationLine: "underline",
  },
});
