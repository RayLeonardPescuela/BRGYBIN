import React, { useEffect, useState } from "react";
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
import { toDate, receiptNoFor } from "../config/receipt";
import shared, { COLORS } from "../styles";

const fmtDate = (value) => {
  if (!value) return "—";
  const d = toDate(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtTime = (value) => {
  if (!value) return "";
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const timeOf = (value) => {
  if (!value) return 0;
  const t = toDate(value).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * The resident's own redemption receipts, newest first — the list
 * behind every "View Receipt" shortcut. Tap a card to open the
 * full receipt (view + PDF share).
 *
 * Equality-only query on purpose: `where userId ==` is served by
 * Firestore's built-in single-field index, so the screen works with
 * no composite index to create first. Newest-first ordering is done
 * client-side here for the same reason — an orderBy() on top of the
 * where() would require that composite index, and a resident's
 * redemptions are few enough that sorting them locally is free.
 */
export default function MyReceipts({ navigation }) {
  const { user } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user?.uid) return;
        const snapshot = await db
          .collection("redemptions")
          .where("userId", "==", user.uid)
          .get();
        if (!alive) return;
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
        setRows(list);
      } catch (error) {
        console.log("Error fetching receipts:", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const totalSpent = rows.reduce(
    (sum, r) => sum + (typeof r.pointsSpent === "number" ? r.pointsSpent : 0),
    0
  );

  const renderItem = ({ item }) => {
    // Older redemptions predate the receipt fields — derive the
    // number exactly like the Receipt screen and the admin portal do.
    const receiptNo = item.receiptNo || receiptNoFor(item.id, item.createdAt);
    const pointsSpent =
      typeof item.pointsSpent === "number" ? item.pointsSpent : 0;
    // Old receipts predate quantity — they were all single-item.
    const qty =
      typeof item.quantity === "number" && item.quantity > 1
        ? item.quantity
        : 1;
    const balance =
      typeof item.balanceAfter === "number"
        ? `${item.balanceAfter} pts`
        : "—";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate("Receipt", { id: item.id })}
        accessibilityLabel={`Receipt ${receiptNo}, ${item.itemName || "redeemed item"}`}
      >
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons name="receipt" size={24} color="#FFF" />
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {qty > 1 ? `${qty} × ` : ""}
            {item.itemName || "Redeemed item"}
          </Text>
          <Text style={styles.cardMeta}>
            {fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}
          </Text>
          <View style={styles.chip}>
            <MaterialCommunityIcons name="receipt-text" size={12} color="#5C7A42" />
            <Text style={styles.chipText}>{receiptNo}</Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.cardPoints}>-{pointsSpent}</Text>
          <Text style={styles.cardPts}>pts</Text>
          <Text style={styles.balanceText}>Bal {balance}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#BBB" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={shared.container}>
      {/* Header */}
      <View style={shared.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={[shared.headerTitle, { marginLeft: 10 }]}>My Receipts</Text>
      </View>

      {loading ? (
        <View style={shared.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : rows.length === 0 ? (
        <View style={shared.center}>
          <MaterialCommunityIcons name="receipt" size={60} color="#999" />
          <Text style={shared.emptyText}>No receipts yet</Text>
          <Text style={shared.emptySubtext}>
            Redeem a reward and your receipt will show up here
          </Text>
        </View>
      ) : (
        <>
          {/* Summary strip */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{rows.length}</Text>
              <Text style={styles.summaryLabel}>Receipts</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryValue, { color: "#E57373" }]}>
                {totalSpent}
              </Text>
              <Text style={styles.summaryLabel}>Points spent</Text>
            </View>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 14,
    paddingVertical: 16,
    elevation: 2,
  },
  summaryBox: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 34, backgroundColor: "#EEE" },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6B8E4E",
    fontFamily: "sans-serif",
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: "sans-serif",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#6B8E4E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  cardMain: { flex: 1, marginRight: 8 },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: COLORS.textDark,
    fontFamily: "sans-serif",
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
    fontFamily: "sans-serif",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#EEF4E8",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#5C7A42",
    letterSpacing: 0.5,
    fontFamily: "sans-serif",
  },
  cardRight: { alignItems: "flex-end" },
  cardPoints: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#E57373",
    fontFamily: "sans-serif",
  },
  cardPts: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: "sans-serif",
  },
  balanceText: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
    marginBottom: 2,
    fontFamily: "sans-serif",
  },
});
