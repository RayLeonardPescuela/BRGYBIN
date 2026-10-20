import React from "react";
import { StatusBar } from "expo-status-bar";
import { Text, View, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import shared, { COLORS } from "../styles";

export default function Getstarted({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Top Illustration */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require("../assets/garbagetruck.png")} 
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* Welcome Title */}
      <Text style={styles.welcomeTitle}>WELCOME!</Text>

      {/* Main Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("SignUp", { google: null })}
        >
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: [shared.container, { alignItems: "center", justifyContent: "space-between", paddingVertical: 50 }],
  illustrationContainer: { width: "100%", alignItems: "center", marginTop: 20 },
  illustration: { width: "90%", height: 280 },
  welcomeTitle: { fontSize: 48, fontWeight: "900", color: COLORS.textDark, fontFamily: "sans-serif", textShadowColor: 'rgba(255, 255, 255, 0.75)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 1 },
  buttonContainer: { width: "100%", alignItems: "center", gap: 15 },
  actionButton: [shared.primaryButton, { width: "80%", borderRadius: 35 }],
  buttonText: [shared.primaryButtonText, { fontSize: 24 }],
  socialSection: { alignItems: "center", width: "100%" },
  socialIconsRow: { flexDirection: "row", gap: 20, marginBottom: 15 },
  socialCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: "transparent", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 16, fontFamily: "sans-serif", color: COLORS.textPrimary },
});