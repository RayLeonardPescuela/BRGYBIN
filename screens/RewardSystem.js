import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Navbar from "../components/Navbar";
import { useUser } from "../config/UserContext";
import shared, { COLORS } from "../styles";

export default function RewardSystem({ navigation }) {
  const { userData } = useUser();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reward System</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Points Balance Card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Your Current Points</Text>
          <View style={styles.pointsRow}>
            <MaterialCommunityIcons name="star-circle" size={50} color="#FFD700" />
            <Text style={styles.pointsValue}>{userData?.points?.toLocaleString() || "0"}</Text>
          </View>
          <Text style={styles.pointsSubtext}>Keep recycling to earn more!</Text>
        </View>

        {/* Description Section */}
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>
            Earn points by participating in community clean-ups and proper waste segregation. 
            Redeem your points for barangay incentives and local store discounts!
          </Text>
        </View>

        {/* Action Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={styles.rewardOption}
            onPress={() => navigation.navigate("QRScanner")}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={40} color="black" />
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Scan for Points</Text>
              <Text style={styles.optionSub}>Scan QR during collection</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="black" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.rewardOption}
            onPress={() => navigation.navigate("RedeemRewards")}
          >
            <MaterialCommunityIcons name="gift-outline" size={40} color="black" />
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Redeem Rewards</Text>
              <Text style={styles.optionSub}>Browse available incentives</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="black" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.rewardOption}
            onPress={() => navigation.navigate("PointHistory")}
          >
            <MaterialCommunityIcons name="history" size={40} color="black" />
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Point History</Text>
              <Text style={styles.optionSub}>See your past contributions</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Navbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  headerContainer: { backgroundColor: COLORS.background, zIndex: 10 },
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  scrollContent: shared.scrollContent,
  pointsCard: { backgroundColor: COLORS.primaryDarker, margin: 20, borderRadius: 25, padding: 30, alignItems: "center", elevation: 5 },
  pointsLabel: { color: COLORS.white, fontSize: 18, fontFamily: "sans-serif" },
  pointsRow: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  pointsValue: { color: COLORS.white, fontSize: 48, fontWeight: "bold", marginLeft: 10 },
  pointsSubtext: { color: COLORS.background, fontSize: 14 },
  descriptionBox: { backgroundColor: COLORS.white, marginHorizontal: 20, padding: 20, borderRadius: 15, marginBottom: 20 },
  descriptionText: { fontSize: 16, fontFamily: "sans-serif", lineHeight: 22, textAlign: "center" },
  optionsContainer: { paddingHorizontal: 20, gap: 15 },
  rewardOption: { backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 20, elevation: 2 },
  optionTextWrapper: { flex: 1, marginLeft: 15 },
  optionTitle: { fontSize: 20, color: COLORS.white, fontFamily: "sans-serif" },
  optionSub: { fontSize: 14, color: COLORS.primaryLight },
});