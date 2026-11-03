import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import shared, { COLORS } from "../styles";

export default function RedeemRewards({ navigation }) {
  const { userData, refreshUserData } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const snapshot = await db.collection("rewardItems").get();
      const itemList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemList);
    } catch (error) {
      console.log("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const redeemItem = async (item) => {
    const userPoints = userData?.points || 0;

    if (userPoints < item.points) {
      Alert.alert("Not Enough Points", `You need ${item.points - userPoints} more points to redeem this item.`);
      return;
    }

    if (item.stock <= 0) {
      Alert.alert("Out of Stock", "This item is currently out of stock.");
      return;
    }

    Alert.alert(
      "Confirm Redemption",
      `Redeem "${item.name}" for ${item.points} points?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: async () => {
            setRedeeming(item.id);
            try {
              // Deduct points
              await db.collection("users").doc(userData.uid || useUser().user.uid).update({
                points: userPoints - item.points,
              });

              // Decrease stock
              await db.collection("rewardItems").doc(item.id).update({
                stock: item.stock - 1,
              });

              // Save redemption history
              await db.collection("redemptions").add({
                userId: userData.uid || useUser().user.uid,
                userName: userData.name,
                itemId: item.id,
                itemName: item.name,
                pointsSpent: item.points,
                createdAt: new Date(),
              });

              await refreshUserData();
              fetchItems();

              Alert.alert("Success!", `You redeemed "${item.name}"!`);
            } catch (error) {
              Alert.alert("Error", "Failed to redeem item.");
              console.log(error);
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const canRedeem = (userData?.points || 0) >= item.points && item.stock > 0;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemIcon}>
          <MaterialCommunityIcons name="gift" size={30} color="#FFF" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDesc}>{item.description || "No description"}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemPoints}>{item.points} pts</Text>
            <Text style={[styles.itemStock, item.stock <= 0 && styles.outOfStock]}>
              {item.stock > 0 ? `${item.stock} left` : "Out of stock"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
          onPress={() => redeemItem(item)}
          disabled={!canRedeem || redeeming === item.id}
        >
          {redeeming === item.id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.redeemBtnText}>Redeem</Text>
          )}
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Redeem Rewards</Text>
      </View>

      {/* Points Balance */}
      <View style={styles.pointsBanner}>
        <MaterialCommunityIcons name="star-circle" size={30} color="#FFD700" />
        <Text style={styles.pointsText}>{userData?.points || 0} Points Available</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="gift-outline" size={60} color="#999" />
          <Text style={styles.emptyText}>No rewards available yet</Text>
          <Text style={styles.emptySubtext}>Check back later!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
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
  pointsBanner: shared.pointsBanner,
  pointsText: shared.pointsBannerText,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  itemCard: shared.itemCard,
  itemIcon: shared.itemIcon,
  itemInfo: shared.itemInfo,
  itemName: shared.itemName,
  itemDesc: shared.itemDesc,
  itemMeta: shared.itemMeta,
  itemPoints: shared.itemPoints,
  itemStock: shared.itemStock,
  outOfStock: { color: COLORS.error },
  redeemBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  redeemBtnDisabled: { backgroundColor: "#CCC" },
  redeemBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" },
});
