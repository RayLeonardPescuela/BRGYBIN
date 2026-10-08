import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../config/firebase";
import { canViewAdminPanel } from "../config/roles";

export default function Login() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email first, then tap Forgot Password");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      await auth.sendPasswordResetEmail(email);
      Alert.alert(
        "Email Sent",
        "A password reset link has been sent to your email. Check your inbox and spam/junk folder."
      );
    } catch (error) {
      console.log("Password reset error:", error.code, error.message);
      if (error.code === "auth/user-not-found") {
        setError("No account found with this email");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address format");
      } else {
        setError("Failed to send reset email. Check your email and try again");
      }
    }
  };

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      const userDoc = await db.collection("users").doc(user.uid).get();
      const userData = userDoc.data();

      if (canViewAdminPanel(userData)) {
        navigation.navigate("AdminHome");
      } else {
        navigation.navigate("Home");
      }
    } catch (error) {
      let message = "Login failed. Please try again.";
      
      if (error.code === "auth/user-not-found") {
        message = "No account found with this email";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password. Please try again";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email address format";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later";
      } else if (error.code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Check your connection";
      } else if (error.code === "auth/user-disabled") {
        message = "This account has been disabled";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header Section */}
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
        <Text style={styles.headerTitle}>Log in</Text>
      </View>

      <View style={styles.content}>
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
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={24}
              color="#3E2723"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
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
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#E57373" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Sign In Button */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        {/* Forgot Password Link */}
        <TouchableOpacity style={styles.forgotContainer} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <TouchableOpacity
          style={styles.signupContainer}
          onPress={() => navigation.navigate("Getstarted")}
        >
          <Text style={styles.signupText}>
            Don't have an account? <Text style={styles.signupBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C5D8A4",
  },
  headerContainer: {
    paddingTop: 40,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "sans-serif",
    fontWeight: "bold",
    color: "#3E2723",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 30,
  },
  illustrationContainer: {
    width: "100%",
    alignItems: "center",
    marginVertical: 20,
  },
  illustration: {
    width: "80%",
    height: 200,
  },
  inputContainer: {
    width: "100%",
    gap: 20,
    marginBottom: 30,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingHorizontal: 20,
    height: 60,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: "sans-serif",
    color: "#3E2723",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 15,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "sans-serif",
    color: "#C62828",
  },
  signInButton: {
    backgroundColor: "#6B8E4E",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 35,
    alignItems: "center",
    elevation: 4,
  },
  buttonText: {
    fontSize: 22,
    color: "#FFF",
    fontFamily: "sans-serif",
    fontWeight: "bold",
  },
  forgotContainer: {
    marginTop: 20,
  },
  forgotText: {
    fontSize: 16,
    fontFamily: "sans-serif",
    color: "#3E2723",
    textDecorationLine: "underline",
  },
  signupContainer: {
    marginTop: 15,
  },
  signupText: {
    fontSize: 16,
    fontFamily: "sans-serif",
    color: "#3E2723",
  },
  signupBold: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
