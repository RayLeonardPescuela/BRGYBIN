import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { auth, db } from "../config/firebase";
import shared, { COLORS } from "../styles";

export default function SignUp() {
  const navigation = useNavigation();
  const route = useRoute();
  // Arriving from Google sign-in: Login passes { google: { name, email } }.
  // The normal flow (Getstarted) passes { google: null } so this never leaks
  // from a previous Google attempt into a fresh email sign-up.
  const googleUser = route.params?.google || null;
  const isGoogleMode = !!googleUser;
  // Pre-fill + lock the fields Google already knows, when it supplied a value.
  const nameLocked = isGoogleMode && !!googleUser.name;
  const [name, setName] = useState(googleUser?.name || "");
  const [email, setEmail] = useState(googleUser?.email || "");
  const [selectedSitio, setSelectedSitio] = useState(null);
  const [sitios, setSitios] = useState([]);
  const [sitiosLoading, setSitiosLoading] = useState(true);
  const [sitioModalVisible, setSitioModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSitios = async () => {
      try {
        const doc = await db.collection("config").doc("sitios").get();
        if (doc.exists) {
          setSitios(doc.data().names || []);
        }
      } catch (err) {
        console.log("Error fetching sitios:", err);
      } finally {
        setSitiosLoading(false);
      }
    };
    fetchSitios();
  }, []);

  const handleSignUp = async () => {
    setError("");

    // Google mode: the Auth account already exists — different path.
    if (isGoogleMode) {
      return handleGoogleRegister();
    }

    if (!name || !email || !selectedSitio || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (name.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );
      const user = userCredential.user;

      await db.collection("users").doc(user.uid).set({
        name: name,
        email: email,
        sitio: selectedSitio,
        points: 0,
        role: "user",
        authProvider: "password",
        createdAt: new Date(),
      });

      // Email verification (Firebase link). If sending fails, the account
      // still exists — VerifyEmail has a Resend button to retry.
      try {
        await user.sendEmailVerification();
      } catch (verifyErr) {
        console.log(
          "sendEmailVerification error:",
          verifyErr.code,
          verifyErr.message
        );
      }

      navigation.navigate("VerifyEmail", { email });
    } catch (error) {
      console.log("Sign up error:", error.code, error.message);
      let message = "Sign up failed. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        message = "An account with this email already exists";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email address format";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak. Use at least 6 characters";
      } else if (error.code === "auth/operation-not-allowed") {
        message = "Email/password sign up is not enabled. Contact support.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Check your connection";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Google mode: the Auth account already exists (created by the Google
  // sign-in), so we must NOT call createUserWithEmailAndPassword. We only
  // write the profile doc and optionally attach a password (option C).
  const handleGoogleRegister = async () => {
    if (!name || !email || !selectedSitio) {
      setError("Please fill in all fields");
      return;
    }

    if (name.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    // Password is optional here — but if they start it, require it to be valid.
    const wantsPassword = !!password || !!confirmPassword;
    if (wantsPassword) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Session expired. Please sign in with Google again.");
        return;
      }

      // Optional password: attach it so they can log in either way later.
      // Non-fatal if it fails (e.g. recent-login required) — Google still works.
      if (wantsPassword) {
        try {
          await user.updatePassword(password);
        } catch (pwErr) {
          console.log("updatePassword error:", pwErr.code, pwErr.message);
        }
      }

      await db.collection("users").doc(user.uid).set({
        name: name,
        email: email,
        sitio: selectedSitio,
        points: 0,
        role: "user",
        authProvider: "google",
        createdAt: new Date(),
      });

      // Google emails are pre-verified — skip the verify step.
      navigation.navigate("Home");
    } catch (error) {
      console.log("Google registration error:", error.code, error.message);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="chevron-double-left"
            size={35}
            color="#4A90E2"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sign Up</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <Image
            source={require("../assets/garbagetruck.png")}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Input Fields */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="account-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#556B2F"
              autoCapitalize="words"
              editable={!nameLocked}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="email-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#556B2F"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isGoogleMode}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Sitio Selector */}
          <TouchableOpacity
            style={styles.inputWrapper}
            onPress={() => setSitioModalVisible(true)}
          >
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <Text
              style={[
                styles.input,
                !selectedSitio && { color: "#556B2F" },
              ]}
            >
              {selectedSitio || "Select Sitio"}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={24}
              color="#3E2723"
            />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={isGoogleMode ? "Password (optional)" : "Password"}
              placeholderTextColor="#556B2F"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialCommunityIcons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={24}
                color="#3E2723"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="lock-check-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={
                isGoogleMode ? "Confirm Password (optional)" : "Confirm Password"
              }
              placeholderTextColor="#556B2F"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <MaterialCommunityIcons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={24}
                color="#3E2723"
              />
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#E57373" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Sign Up Button */}
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Link (hidden in Google mode — they're already signed in) */}
        {!isGoogleMode && (
          <TouchableOpacity
            style={styles.loginContainer}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginBold}>Log in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sitio Picker Modal */}
      <Modal visible={sitioModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sitio</Text>
              <TouchableOpacity onPress={() => setSitioModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={26} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {sitiosLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : sitios.length === 0 ? (
              <View style={styles.modalEmpty}>
                <MaterialCommunityIcons name="map-marker-off" size={40} color={COLORS.textMuted} />
                <Text style={styles.noSitiosText}>No sitios available. Contact admin.</Text>
              </View>
            ) : (
              <FlatList
                data={sitios}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalOption,
                      selectedSitio === item && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedSitio(item);
                      setSitioModalVisible(false);
                    }}
                  >
                    <View style={styles.radioCircle}>
                      {selectedSitio === item && <View style={styles.radioSelected} />}
                    </View>
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedSitio === item && styles.modalOptionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  headerContainer: [shared.headerWithTitle, { paddingTop: 40 }],
  backButton: shared.backButton,
  headerTitle: shared.headerTitleLarge,
  scrollContent: { alignItems: "center", paddingHorizontal: 30, paddingBottom: 40 },
  illustrationContainer: { width: "100%", alignItems: "center", marginVertical: 15 },
  illustration: { width: "70%", height: 150 },
  inputContainer: { width: "100%", gap: 15, marginBottom: 25 },
  inputWrapper: [shared.inputWrapper, { height: 55 }],
  inputIcon: shared.inputIcon,
  input: shared.inputField,
  errorContainer: shared.errorContainer,
  errorText: shared.errorText,
  signUpButton: [shared.primaryButton, { width: "100%", borderRadius: 35 }],
  buttonText: shared.primaryButtonText,
  loginContainer: { marginTop: 20 },
  loginText: { fontSize: 16, fontFamily: "sans-serif", color: COLORS.textDark },
  loginBold: { fontWeight: "bold", textDecorationLine: "underline" },

  // Sitio modal
  noSitiosText: {
    fontSize: 14,
    fontFamily: "sans-serif",
    color: COLORS.textMuted,
    textAlign: "center",
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.textDark,
  },
  modalEmpty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  modalOptionActive: {
    backgroundColor: COLORS.primaryLight,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: "sans-serif",
    color: COLORS.textDark,
  },
  modalOptionTextActive: {
    fontWeight: "bold",
    color: COLORS.primary,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
});
