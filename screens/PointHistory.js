import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import shared, { COLORS } from "../styles";

export default function PointHistory({ navigation }) {
  const { user } = useUser();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Two independent halves of the history — earned vs spent. Run
      // them together: one round trip instead of two.
      const [earnedSnapshot, redeemedSnapshot] = await Promise.all([
        db
          .collection("pointHistory")
          .where("userId", "==", user.uid)
          .orderBy("createdAt", "desc")
          .get(),
        db
          .collection("redemptions")
          .where("userId", "==", user.uid)
          .orderBy("createdAt", "desc")
          .get(),
      ]);

      const earned = earnedSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: "earned",
        ...doc.data(),
      }));

      const redeemed = redeemedSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: "spent",
        ...doc.data(),
      }));

      const combined = [...earned, ...redeemed].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setHistory(combined);
    } catch (error) {
      console.log("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTotalEarned = () => {
    return history
      .filter((item) => item.type === "earned")
      .reduce((sum, item) => sum + (item.points || 0), 0);
  };

  const getTotalSpent = () => {
    return history
      .filter((item) => item.type === "spent")
      .reduce((sum, item) => sum + (item.pointsSpent || 0), 0);
  };

  const renderItem = ({ item }) => {
    const isEarned = item.type === "earned";
    const points = isEarned ? item.points : item.pointsSpent;
    const label = isEarned
      ? item.description || "QR Code Reward"
      : item.itemName || "Redeemed Item";

    return (
      <View style={styles.historyCard}>
        <View style={[styles.iconContainer, { backgroundColor: isEarned ? "#4CAF50" : "#E57373" }]}>
          <MaterialCommunityIcons
            name={isEarned ? "plus-circle-outline" : "minus-circle-outline"}
            size={24}
            color="#FFF"
          />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyLabel} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          <Text style={styles.historyDate}>
            {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
          </Text>
        </View>
        <Text style={[styles.historyPoints, { color: isEarned ? "#4CAF50" : "#E57373" }]}>
          {isEarned ? "+" : "-"}{points}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Point History</Text>
      </View>
      <View style={styles.divider} />

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#4CAF50" }]}>
          <MaterialCommunityIcons name="arrow-up-bold" size={20} color="#FFF" />
          <Text style={styles.summaryValue}>+{getTotalEarned()}</Text>
          <Text style={styles.summaryLabel}>Earned</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#E57373" }]}>
          <MaterialCommunityIcons name="arrow-down-bold" size={20} color="#FFF" />
          <Text style={styles.summaryValue}>-{getTotalSpent()}</Text>
          <Text style={styles.summaryLabel}>Spent</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="history" size={60} color="#999" />
          <Text style={styles.emptyText}>No point history yet</Text>
          <Text style={styles.emptySubtext}>Scan QR codes or redeem rewards to see activity</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  summaryRow: shared.summaryRow,
  summaryCard: shared.summaryCard,
  summaryValue: shared.summaryValue,
  summaryLabel: shared.summaryLabel,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  historyCard: shared.historyCard,
  iconContainer: shared.historyIcon,
  historyInfo: shared.historyInfo,
  historyLabel: shared.historyLabel,
  historyDate: shared.historyDate,
  historyPoints: shared.historyPoints,
});
