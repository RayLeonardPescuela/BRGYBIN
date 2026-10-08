import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import firebase from "firebase/compat/app";
import { auth, db } from "../config/firebase";
import { canViewAdminPanel } from "../config/roles";
import shared, { COLORS } from "../styles";

GoogleSignin.configure({
  webClientId: "188250769398-9s7gp1v7i1qk7b5c5c5c5c5c5c5c5c5c.apps.googleusercontent.com",
});

export default function GoogleSignIn({ navigation }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken || userInfo.user?.idToken;

      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth.signInWithCredential(credential);
      const user = userCredential.user;

      const userDoc = await db.collection("users").doc(user.uid).get();

      if (!userDoc.exists) {
        await db.collection("users").doc(user.uid).set({
          name: user.displayName || "Google User",
          email: user.email || "",
          sitio: "",
          points: 0,
          role: "user",
          profileImage: user.photoURL || null,
          createdAt: new Date(),
        });
        navigation.navigate("Home");
      } else {
        const userData = userDoc.data();
        if (canViewAdminPanel(userData)) {
          navigation.navigate("AdminHome");
        } else {
          navigation.navigate("Home");
        }
      }
    } catch (error) {
      console.log("Google Sign-In error:", error);
      if (error.code === "SIGN_IN_CANCELLED") {
        // User cancelled, do nothing
      } else {
        Alert.alert("Error", "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image source={require("../assets/google_logo.png")} style={styles.googleLogo} />
        <Text style={styles.headerText}>Sign in with Google</Text>
      </View>
      <View style={styles.line} />

      <View style={styles.content}>
        <Image source={require("../assets/garbagecan.png")} style={styles.illustration} />

        <Text style={styles.titleText}>Sign in with Google</Text>
        <Text style={styles.subText}>
          to continue to <Text style={styles.brandText}>BRGY BIN</Text>
        </Text>

        <TouchableOpacity
          style={[styles.signInButton, loading && { opacity: 0.6 }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="google" size={24} color="#FFF" />
              <Text style={styles.signInText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By signing in, you agree to BRGY BIN's{" "}
          <Text style={styles.linkText}>privacy policy</Text> and{" "}
          <Text style={styles.linkText}>terms of service</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: "row", alignItems: "center", padding: 15, paddingTop: 45 },
  googleLogo: { width: 22, height: 22, marginRight: 15 },
  headerText: { fontSize: 18, color: "#5F6368" },
  line: { height: 1, backgroundColor: COLORS.black, width: "100%" },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 40 },
  illustration: { width: 100, height: 100, marginBottom: 20 },
  titleText: { fontSize: 28, fontFamily: "sans-serif", color: COLORS.black, fontWeight: "400", marginBottom: 5 },
  subText: { fontSize: 16, marginBottom: 40, color: COLORS.textPrimary },
  brandText: { color: COLORS.secondary, fontWeight: "bold" },
  signInButton: { flexDirection: "row", backgroundColor: COLORS.googleBlue, width: "100%", paddingVertical: 16, borderRadius: 30, justifyContent: "center", alignItems: "center", gap: 10, elevation: 3, marginBottom: 30 },
  signInText: { color: COLORS.white, fontSize: 18, fontFamily: "sans-serif", fontWeight: "bold" },
  footerText: { fontSize: 13, color: COLORS.black, lineHeight: 18, fontFamily: "sans-serif", textAlign: "center" },
  linkText: { color: COLORS.accent },
});
