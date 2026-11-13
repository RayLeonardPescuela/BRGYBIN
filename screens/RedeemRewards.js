import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { receiptNoFor } from "../config/receipt";
import shared, { COLORS } from "../styles";

// The slider is a native module — never require() it on web, where
// it would throw; the quantity picker falls back to the text input
// and steppers there (same gate pattern as Login's Google sign-in).
const SliderModule =
  Platform.OS === "web" ? null : require("@react-native-community/slider");
const Slider = SliderModule ? SliderModule.default || SliderModule : null;

export default function RedeemRewards({ navigation }) {
  const { user, userData, refreshUserData } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  // Quantity picker: the item being confirmed + the typed quantity
  // (kept as text so the box can be cleared while editing; every
  // calculation parses it back through qtyForCalc below).
  const [confirmItem, setConfirmItem] = useState(null);
  const [qtyText, setQtyText] = useState("1");

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

  const userPoints = userData?.points || 0;

  // The most this resident may buy: capped by what's in stock and by
  // what their balance covers at this item's price.
  const affordableQty = confirmItem
    ? confirmItem.points > 0
      ? Math.floor(userPoints / confirmItem.points)
      : confirmItem.stock
    : 0;
  const maxQty = confirmItem
    ? Math.max(0, Math.min(confirmItem.stock, affordableQty))
    : 0;

  const qtyNum = parseInt(qtyText, 10);
  const qtyForCalc = Number.isInteger(qtyNum) && qtyNum >= 1 ? qtyNum : 0;
  const qtyValid =
    confirmItem != null && qtyForCalc >= 1 && qtyForCalc <= maxQty;
  const total = confirmItem ? qtyForCalc * confirmItem.points : 0;
  const balanceAfter = userPoints - total;

  const qtyWarning = !confirmItem
    ? ""
    : qtyForCalc < 1
    ? "Enter a quantity of at least 1"
    : qtyForCalc > confirmItem.stock
    ? `Only ${confirmItem.stock} left`
    : total > userPoints
    ? "Not enough points"
    : "";

  // Where the slider should sit for the current text (clamped into
  // 1..max so an overshooting keystroke can't park it out of range).
  const sliderValue = Math.min(
    Math.max(qtyForCalc || 1, 1),
    Math.max(maxQty, 1)
  );

  const openConfirm = (item) => {
    if (userPoints < item.points) {
      Alert.alert(
        "Not Enough Points",
        `You need ${item.points - userPoints} more points to redeem this item.`
      );
      return;
    }
    if (item.stock <= 0) {
      Alert.alert("Out of Stock", "This item is currently out of stock.");
      return;
    }
    setQtyText("1");
    setConfirmItem(item);
  };

  // The native confirm Alert is gone: it cannot host a slider or a
  // text input, so confirmation is this in-app modal instead.
  const closeConfirm = () => {
    if (redeeming) return; // no dismissing mid-commit
    setConfirmItem(null);
  };

  const setQty = (n) => setQtyText(String(n));

  const stepQty = (delta) => {
    const current = qtyForCalc || 1;
    setQty(Math.min(Math.max(current + delta, 1), Math.max(maxQty, 1)));
  };

  // Typing can overshoot (or empty the box) — settle it on blur so
  // the field never keeps a value the Redeem button would reject.
  const clampQty = () => {
    if (maxQty < 1 || qtyForCalc < 1) {
      setQtyText("1");
      return;
    }
    setQty(Math.min(qtyForCalc, maxQty));
  };

  const confirmRedeem = async () => {
    const item = confirmItem;
    if (!item || !qtyValid) return;

    setRedeeming(item.id);
    try {
      const uid = user?.uid;
      if (!uid) throw new Error("Not signed in");
      const qty = qtyForCalc;
      const pointsSpent = qty * item.points;
      const newBalance = userPoints - pointsSpent;
      const now = new Date();

      // One atomic batch: points, stock and the receipt either all
      // land or none do. Separate writes could leave a half-done
      // redemption behind — points deducted but no receipt, or stock
      // gone with nothing recorded — if one failed halfway.
      const batch = db.batch();
      batch.update(db.collection("users").doc(uid), {
        points: newBalance,
      });
      batch.update(db.collection("rewardItems").doc(item.id), {
        stock: item.stock - qty,
      });

      // The receipt. quantity + unitPoints describe the line item;
      // pointsSpent stays the TOTAL (unitPoints × quantity) so every
      // existing screen and stat keeps working unchanged. balanceAfter
      // and receiptNo are stamped here because they are point-in-time
      // values that cannot be derived later.
      const redemptionRef = db.collection("redemptions").doc();
      batch.set(redemptionRef, {
        userId: uid,
        userName: userData.name,
        itemId: item.id,
        itemName: item.name,
        quantity: qty,
        unitPoints: item.points,
        pointsSpent,
        balanceAfter: newBalance,
        receiptNo: receiptNoFor(redemptionRef.id, now),
        createdAt: now,
      });

      await batch.commit();

      setConfirmItem(null);
      await refreshUserData();
      fetchItems();

      const what = qty > 1 ? `${qty} × "${item.name}"` : `"${item.name}"`;
      Alert.alert("Success!", `You redeemed ${what}!`, [
        { text: "OK" },
        {
          text: "View Receipt",
          onPress: () =>
            navigation.navigate("Receipt", { id: redemptionRef.id }),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to redeem item.");
      console.log(error);
    } finally {
      setRedeeming(null);
    }
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
          onPress={() => openConfirm(item)}
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
        {/* Shortcut to this resident's receipt list */}
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.navigate("MyReceipts")}
          accessibilityLabel="My receipts"
        >
          <MaterialCommunityIcons name="receipt-text" size={26} color="#4A90E2" />
        </TouchableOpacity>
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

      {/* Quantity picker: slider + text input + steppers, with live
          totals. Replaces the old native confirm Alert, which cannot
          host any of these controls. */}
      <Modal
        visible={!!confirmItem}
        animationType="slide"
        transparent
        onRequestClose={closeConfirm}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeConfirm}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How many do you want?</Text>
            {confirmItem && (
              <>
                <Text style={styles.modalItemName}>{confirmItem.name}</Text>
                <Text style={styles.modalPrice}>
                  {confirmItem.points} pts each
                </Text>

                <Text style={styles.modalLabel}>
                  Quantity{maxQty > 0 ? ` (max ${maxQty})` : ""}
                </Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={[
                      styles.stepBtn,
                      qtyForCalc <= 1 && styles.stepBtnDisabled,
                    ]}
                    onPress={() => stepQty(-1)}
                    disabled={qtyForCalc <= 1}
                    accessibilityLabel="Decrease quantity"
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.qtyInput}
                    value={qtyText}
                    onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, ""))}
                    onBlur={clampQty}
                    onSubmitEditing={clampQty}
                    keyboardType="number-pad"
                    maxLength={4}
                    selectTextOnFocus
                    accessibilityLabel="Quantity"
                  />
                  <TouchableOpacity
                    style={[
                      styles.stepBtn,
                      qtyForCalc >= maxQty && styles.stepBtnDisabled,
                    ]}
                    onPress={() => stepQty(1)}
                    disabled={qtyForCalc >= maxQty}
                    accessibilityLabel="Increase quantity"
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Native-only — on web the module is never required
                    (see the gate at the top of this file), so the
                    steppers and typed input carry the picker alone. */}
                {Slider ? (
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={Math.max(maxQty, 1)}
                    step={1}
                    value={sliderValue}
                    onValueChange={(v) => setQty(Math.round(v))}
                    disabled={maxQty < 1}
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor="#DDDDDD"
                    thumbTintColor={COLORS.primary}
                  />
                ) : null}

                <View style={styles.totalsBox}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{total} pts</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Balance after</Text>
                    <Text
                      style={[
                        styles.totalValue,
                        {
                          color:
                            balanceAfter < 0 ? COLORS.error : COLORS.success,
                        },
                      ]}
                    >
                      {balanceAfter} pts
                    </Text>
                  </View>
                </View>

                {qtyWarning ? (
                  <Text style={styles.qtyWarning}>{qtyWarning}</Text>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={closeConfirm}
                    disabled={!!redeeming}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      (!qtyValid || redeeming) && styles.saveBtnDisabled,
                    ]}
                    onPress={confirmRedeem}
                    disabled={!qtyValid || !!redeeming}
                  >
                    {redeeming ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.saveBtnText}>Redeem</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  headerAction: { marginLeft: "auto", padding: 4 },
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

  // Quantity picker modal (layout mirrors CleaningSchedule's modal)
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "center", paddingHorizontal: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 20, padding: 25, zIndex: 1 },
  modalTitle: { fontSize: 22, fontWeight: "bold", fontFamily: "sans-serif", textAlign: "center", color: COLORS.textDark },
  modalItemName: { fontSize: 17, fontWeight: "700", fontFamily: "sans-serif", textAlign: "center", marginTop: 10, color: COLORS.textPrimary },
  modalPrice: { fontSize: 13, fontFamily: "sans-serif", color: COLORS.textMuted, textAlign: "center", marginTop: 3 },
  modalLabel: { fontSize: 14, fontFamily: "sans-serif", fontWeight: "600", color: COLORS.textPrimary, marginTop: 18, marginBottom: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  stepBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontSize: 26, fontWeight: "bold", color: COLORS.primary, fontFamily: "sans-serif", lineHeight: 30 },
  qtyInput: { minWidth: 84, backgroundColor: COLORS.inputBg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 24, fontWeight: "bold", textAlign: "center", fontFamily: "sans-serif", color: COLORS.textDark },
  slider: { width: "100%", height: 40, marginTop: 10 },
  totalsBox: { backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 14, marginTop: 14 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  totalLabel: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textSecondary },
  totalValue: { fontSize: 15, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textDark },
  qtyWarning: { fontSize: 13, fontFamily: "sans-serif", fontWeight: "600", color: COLORS.error, textAlign: "center", marginTop: 10 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, gap: 15 },
  cancelBtn: { flex: 1, backgroundColor: COLORS.cancelBg, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancelBtnText: { fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: COLORS.white, fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
});
