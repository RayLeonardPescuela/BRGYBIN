import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { db } from "../config/firebase";
import { toDate, receiptNoFor } from "../config/receipt";
import shared, { COLORS } from "../styles";

// Receipt text is rendered inside HTML for the PDF — resident and
// item names are user-supplied, so escape them before they touch markup.
const escapeHtml = (value) =>
  String(value == null ? "" : value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Firestore reads timestamps back as Timestamp objects — see
// config/receipt.js for why a bare new Date() would show Invalid Date.
const formatDate = (value) => {
  if (!value) return "—";
  const date = toDate(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";
  const date = toDate(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

function Row({ label, value, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueStyle]} numberOfLines={2} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
}

/**
 * A single redemption's receipt — viewable in-app and shareable as
 * a PDF. Reached from RedeemRewards' success alert and from the
 * "spent" rows in PointHistory (route param: { id }).
 *
 * Static by design: no claim/status tracking. It shows what the
 * redemption record says, and that is all.
 */
export default function Receipt({ route, navigation }) {
  const id = route?.params?.id;
  const [receipt, setReceipt] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharingPdf, setSharingPdf] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!id) {
          if (alive) setNotFound(true);
          return;
        }
        const snapshot = await db.collection("redemptions").doc(id).get();
        if (!alive) return;
        if (snapshot.exists) {
          setReceipt({ id: snapshot.id, ...snapshot.data() });
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.log("Error fetching receipt:", error);
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Older redemptions predate the receipt fields: derive the number
  // from the doc ID and show an em dash where balance is unknown.
  const receiptNo = receipt
    ? receipt.receiptNo || receiptNoFor(receipt.id, receipt.createdAt)
    : "";
  const pointsSpent =
    receipt && typeof receipt.pointsSpent === "number" ? receipt.pointsSpent : 0;
  // Old receipts predate quantity — they were all single-item.
  const quantity =
    receipt && typeof receipt.quantity === "number" && receipt.quantity > 1
      ? receipt.quantity
      : 1;
  const balanceAfter =
    receipt && typeof receipt.balanceAfter === "number"
      ? `${receipt.balanceAfter} pts`
      : "—";

  const buildHtml = () => {
    const rows = [
      ["Date", formatDate(receipt.createdAt), ""],
      ["Time", formatTime(receipt.createdAt) || "—", ""],
      ["Resident", receipt.userName || "—", ""],
      ["Item", receipt.itemName || "—", ""],
      ...(quantity > 1 ? [["Quantity", String(quantity), ""]] : []),
      ["Points spent", `-${pointsSpent} pts`, "red"],
      ["Balance after", balanceAfter, "green"],
      ["Status", "REDEEMED", "green"],
    ];
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(receiptNo)}</title>
<style>
  @page { margin: 24px; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #fff;
    color: #222;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .receipt {
    max-width: 560px;
    margin: 0 auto;
    border: 1px solid #e2e2e2;
    border-radius: 14px;
    overflow: hidden;
  }
  .band {
    background: #6B8E4E;
    color: #fff;
    padding: 24px;
    text-align: center;
  }
  .band .kicker {
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .band .title { font-size: 20px; font-weight: 700; margin-top: 6px; }
  .band .no { font-size: 24px; font-weight: 700; margin-top: 10px; letter-spacing: 1px; }
  .body { padding: 18px 24px; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px dashed #e6e6e6;
    font-size: 15px;
  }
  .row:last-child { border-bottom: none; }
  .k { color: #777; }
  .v { font-weight: 600; text-align: right; }
  .v.red { color: #E57373; }
  .v.green { color: #4CAF50; }
  .foot {
    background: #fafafa;
    border-top: 1px solid #ececec;
    padding: 14px 24px;
    font-size: 12px;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="band">
      <div class="kicker">BRGY BIN</div>
      <div class="title">Redemption Receipt</div>
      <div class="no">${escapeHtml(receiptNo)}</div>
    </div>
    <div class="body">
      ${rows
        .map(
          ([key, value, cls]) =>
            `<div class="row"><span class="k">${escapeHtml(key)}</span><span class="v ${cls}">${escapeHtml(value)}</span></div>`
        )
        .join("\n      ")}
    </div>
    <div class="foot">Generated automatically by the BRGY BIN app · Barangay waste management</div>
  </div>
</body>
</html>`;
  };

  const sharePdf = async () => {
    if (!receipt) return;
    try {
      setSharingPdf(true);
      const { uri } = await Print.printToFileAsync({ html: buildHtml() });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "This device cannot share files.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Receipt ${receiptNo}`,
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      console.log("Error sharing receipt:", error);
      Alert.alert("Could not share", "The receipt PDF could not be created.");
    } finally {
      setSharingPdf(false);
    }
  };

  return (
    <SafeAreaView style={shared.container}>
      {/* Header */}
      <View style={shared.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={[shared.headerTitle, { marginLeft: 10 }]}>Receipt</Text>
      </View>

      {loading ? (
        <View style={shared.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : notFound || !receipt ? (
        <View style={shared.center}>
          <MaterialCommunityIcons name="receipt" size={60} color="#999" />
          <Text style={shared.emptyText}>Receipt not found</Text>
          <Text style={shared.emptySubtext}>This receipt may have been removed</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.band}>
              <MaterialCommunityIcons name="receipt" size={34} color="#FFF" />
              <Text style={styles.bandTitle}>Redemption Receipt</Text>
              <Text style={styles.bandNo}>{receiptNo}</Text>
            </View>

            <View style={styles.body}>
              <Row label="Date" value={formatDate(receipt.createdAt)} />
              <Row label="Time" value={formatTime(receipt.createdAt) || "—"} />
              <Row label="Resident" value={receipt.userName || "—"} />
              <Row label="Item" value={receipt.itemName || "—"} />
              {quantity > 1 && <Row label="Quantity" value={`${quantity}`} />}
              <Row
                label="Points spent"
                value={`-${pointsSpent} pts`}
                valueStyle={styles.spent}
              />
              <Row
                label="Balance after"
                value={balanceAfter}
                valueStyle={styles.balance}
              />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Status</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>REDEEMED</Text>
                </View>
              </View>
            </View>

            <Text style={styles.footNote}>
              Generated automatically by the BRGY BIN app
            </Text>
          </View>

          {/* printToFileAsync has no web implementation — the portal
              prints receipts from its own page instead. */}
          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={[styles.shareBtn, sharingPdf && styles.shareBtnDisabled]}
              onPress={sharePdf}
              disabled={sharingPdf}
              activeOpacity={0.8}
            >
              {sharingPdf ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />
                  <Text style={styles.shareText}>Share PDF</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: shared.headerTitle,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 3,
  },
  band: {
    backgroundColor: "#6B8E4E",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  bandTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    letterSpacing: 1,
    fontFamily: "sans-serif",
  },
  bandNo: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
    letterSpacing: 1,
    fontFamily: "sans-serif",
  },
  body: { paddingHorizontal: 20, paddingTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    gap: 16,
  },
  rowLabel: { fontSize: 14, color: COLORS.textMuted, fontFamily: "sans-serif" },
  rowValue: { fontSize: 15, fontWeight: "600", fontFamily: "sans-serif", flexShrink: 1, textAlign: "right" },
  spent: { color: "#E57373" },
  balance: { color: "#4CAF50" },
  statusPill: {
    backgroundColor: "#E8F5E9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusText: { color: "#4CAF50", fontSize: 13, fontWeight: "bold", fontFamily: "sans-serif" },
  footNote: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontFamily: "sans-serif",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6B8E4E",
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 18,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareText: { color: "#FFF", fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif" },
});
