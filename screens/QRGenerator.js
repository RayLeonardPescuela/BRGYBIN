import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canViewAdminPanel } from "../config/roles";
import shared, { COLORS } from "../styles";

// One calendar day key, e.g. "2026-10-08" (device local time)
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const toDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : new Date(v));

// Same payload format the scanner expects: { id, points, description, createdAt, expiresAt }
const buildQrUrl = (id, points, description, createdAt, expiresAt) => {
  const payload = JSON.stringify({
    id,
    points,
    description,
    createdAt: toDate(createdAt).toISOString(),
    expiresAt: toDate(expiresAt).toISOString(),
  });
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    payload
  )}`;
};

export default function QRGenerator({ navigation }) {
  const { user, userData } = useUser();
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [qrImage, setQrImage] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Collector flow: fixed preset points + one QR per day
  const isCollector = userData?.role === "collector";
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [setupLoading, setSetupLoading] = useState(isCollector);
  const [usedToday, setUsedToday] = useState(false);
  const [redisplayed, setRedisplayed] = useState(false);

  // Load preset list + check whether this collector already generated today
  useEffect(() => {
    if (!isCollector) return;
    if (!user?.uid) {
      setSetupLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const [cfg, todaySnap] = await Promise.all([
          db.collection("config").doc("collectorQr").get(),
          db.collection("rewards").doc(`${user.uid}_${dayKey()}`).get(),
        ]);

        if (!alive) return;

        const list = cfg.exists ? cfg.data().points || [] : [];
        setPresets(list.filter((n) => typeof n === "number" && n > 0));

        if (todaySnap.exists) {
          const d = todaySnap.data();
          setPoints(String(d.points ?? ""));
          setDescription(d.description || "");
          setQrImage(
            buildQrUrl(todaySnap.id, d.points, d.description, d.createdAt, d.expiresAt)
          );
          setUsedToday(true);
          setRedisplayed(true);
          setGenerated(true);
        }
      } catch (error) {
        console.log("Error loading QR setup:", error);
      } finally {
        if (alive) setSetupLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isCollector, user?.uid]);

  const showQr = (id, data, wasExisting) => {
    setPoints(String(data.points));
    setDescription(data.description || "");
    setQrImage(buildQrUrl(id, data.points, data.description, data.createdAt, data.expiresAt));
    setUsedToday(true);
    setRedisplayed(!!wasExisting);
    setGenerated(true);
  };

  const generateCollectorQR = async () => {
    if (setupLoading) return;
    if (presets.length === 0) {
      Alert.alert("Not configured", "Point options aren't set yet — contact the Main Admin.");
      return;
    }
    if (selectedPreset == null) {
      Alert.alert("Choose points", "Pick one of the fixed point options first.");
      return;
    }
    if (usedToday) {
      Alert.alert(
        "Daily limit reached",
        "You've already generated a QR code today. Next generation: tomorrow."
      );
      return;
    }

    setGenerating(true);
    try {
      const today = dayKey();
      const docId = `${user.uid}_${today}`;
      const ref = db.collection("rewards").doc(docId);

      // One doc per collector per day — a second device can't create another
      const existing = await ref.get();
      if (existing.exists) {
        showQr(docId, existing.data(), true);
        Alert.alert("Already generated", "You've already generated today's QR code.");
        return;
      }

      const rewardData = {
        points: selectedPreset,
        description: description || `Reward for ${selectedPreset} points`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scannedBy: [],
        createdBy: user.uid,
        createdByRole: "collector",
        day: today,
      };
      await ref.set(rewardData);
      showQr(docId, rewardData, false);
    } catch (error) {
      Alert.alert("Error", "Failed to generate QR code");
      console.log(error);
    } finally {
      setGenerating(false);
    }
  };

  const generateQR = async () => {
    if (isCollector) {
      await generateCollectorQR();
      return;
    }

    // Main Admin: custom points, unlimited
    if (!points || parseInt(points) <= 0) {
      Alert.alert("Error", "Please enter valid points");
      return;
    }

    setGenerating(true);
    try {
      const rewardData = {
        points: parseInt(points),
        description: description || `Reward for ${points} points`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scannedBy: [],
      };

      const docRef = await db.collection("rewards").add(rewardData);

      const qrPayload = JSON.stringify({
        id: docRef.id,
        points: parseInt(points),
        description: rewardData.description,
        createdAt: rewardData.createdAt.toISOString(),
        expiresAt: rewardData.expiresAt.toISOString(),
      });

      // Use QR code API to generate image
      const encodedData = encodeURIComponent(qrPayload);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedData}`;

      setQrImage(qrUrl);
      setGenerated(true);
    } catch (error) {
      Alert.alert("Error", "Failed to generate QR code");
      console.log(error);
    } finally {
      setGenerating(false);
    }
  };

  const resetGenerator = () => {
    setPoints("");
    setDescription("");
    setQrImage(null);
    setGenerated(false);
    setSelectedPreset(null);
  };

  const downloadQR = async () => {
    if (!qrImage) return;
    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = qrImage;
        link.download = `qr-reward-${points}pts.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await Linking.openURL(qrImage);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to download QR code");
    }
  };

  // Creating a QR is staff-only: Main Admin (any points) + Collector (fixed, 1/day)
  if (userData && !canViewAdminPanel(userData)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR Generator</Text>
        </View>
        <View style={styles.divider} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <MaterialCommunityIcons name="lock" size={60} color="#999" />
          <Text style={{ fontSize: 16, marginTop: 10, color: "#666", fontFamily: "sans-serif" }}>
            Admin or Collector access required
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const generateDisabled =
    generating || setupLoading || (isCollector && (presets.length === 0 || selectedPreset == null));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Generator</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!generated ? (
          <>
            <View style={styles.inputSection}>
              {isCollector ? (
                <>
                  <Text style={styles.label}>Fixed Points (set by Main Admin)</Text>

                  {setupLoading ? (
                    <ActivityIndicator
                      color={COLORS.primary}
                      style={{ marginBottom: 20 }}
                    />
                  ) : presets.length === 0 ? (
                    <View style={[styles.noticeCard, styles.noticeWarn]}>
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={22}
                        color={COLORS.error}
                      />
                      <Text style={styles.noticeText}>
                        Point options aren't configured yet — contact the Main Admin.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.chipRow}>
                        {presets.map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[styles.chip, selectedPreset === p && styles.chipActive]}
                            onPress={() => setSelectedPreset(p)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                selectedPreset === p && styles.chipTextActive,
                              ]}
                            >
                              {p} pts
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.hint}>
                        You can generate 1 QR code per day. Come back tomorrow to generate
                        another.
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.label}>Points to Award</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 50"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={points}
                    onChangeText={setPoints}
                  />
                </>
              )}

              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Proper segregation reward"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity
                style={[styles.generateBtn, generateDisabled && { opacity: 0.55 }]}
                onPress={generateQR}
                disabled={generateDisabled}
              >
                {generating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="qrcode" size={24} color="#FFF" />
                    <Text style={styles.generateBtnText}>Generate QR Code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>Scan this QR Code</Text>
              <Text style={styles.qrPoints}>{points} Points</Text>

              {isCollector && usedToday && (
                <View style={[styles.noticeCard, styles.noticeInfo]}>
                  <MaterialCommunityIcons name="information" size={22} color="#4A90E2" />
                  <Text style={styles.noticeText}>
                    {redisplayed
                      ? "You've already generated today's QR code — reuse this one. Next generation: tomorrow."
                      : "QR generated! Show it to residents. Next generation available tomorrow."}
                  </Text>
                </View>
              )}

              <View style={styles.qrContainer}>
                {qrImage && (
                  <Image
                    source={{ uri: qrImage }}
                    style={{ width: 250, height: 250 }}
                  />
                )}
              </View>

              <Text style={styles.qrDesc}>{description || `Reward for ${points} points`}</Text>
              <Text style={styles.qrExpiry}>Valid for 24 hours</Text>

              <View style={styles.infoCard}>
                <MaterialCommunityIcons name="information" size={24} color="#4A90E2" />
                <Text style={styles.infoText}>
                  Show this QR code to users. They can scan it using the "Scan QR" button in the Reward System to earn {points} points.
                </Text>
              </View>

              <TouchableOpacity style={styles.downloadBtn} onPress={downloadQR}>
                <MaterialCommunityIcons name="download" size={20} color="#FFF" />
                <Text style={styles.downloadBtnText}>Download QR Code</Text>
              </TouchableOpacity>

              <View style={styles.actions}>
                {!isCollector && (
                  <TouchableOpacity style={styles.resetBtn} onPress={resetGenerator}>
                    <MaterialCommunityIcons name="refresh" size={20} color="#333" />
                    <Text style={styles.resetBtnText}>Generate New</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  inputSection: { marginTop: 20 },
  label: { fontSize: 16, fontFamily: "sans-serif", fontWeight: "600", marginBottom: 8, color: COLORS.textPrimary },
  input: [shared.card, { padding: 15, marginBottom: 20 }],
  hint: { fontSize: 13, fontFamily: "sans-serif", color: COLORS.textSecondary, marginTop: -10, marginBottom: 20, lineHeight: 18 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  chip: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 25, backgroundColor: COLORS.white, borderWidth: 2, borderColor: "#DDD", elevation: 1 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 15, fontFamily: "sans-serif", fontWeight: "600", color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.white },
  noticeCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 },
  noticeWarn: { backgroundColor: "#FDECEA" },
  noticeInfo: { backgroundColor: "#EAF2FB", alignSelf: "stretch", marginBottom: 18 },
  noticeText: { flex: 1, fontSize: 14, fontFamily: "sans-serif", color: COLORS.textPrimary, lineHeight: 20 },
  generateBtn: [shared.primaryButton, { flexDirection: "row", justifyContent: "center", gap: 10 }],
  generateBtnText: shared.primaryButtonText,
  qrSection: { alignItems: "center", marginTop: 20 },
  qrTitle: { fontSize: 22, fontFamily: "sans-serif", fontWeight: "bold", marginBottom: 5 },
  qrPoints: { fontSize: 32, fontFamily: "sans-serif", fontWeight: "bold", color: COLORS.primary, marginBottom: 20 },
  qrContainer: { backgroundColor: COLORS.white, padding: 20, borderRadius: 20, elevation: 5, marginBottom: 15 },
  qrDesc: { fontSize: 16, fontFamily: "sans-serif", color: COLORS.textSecondary, marginBottom: 5 },
  qrExpiry: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.error, marginBottom: 20 },
  infoCard: { flexDirection: "row", backgroundColor: COLORS.blue, borderRadius: 15, padding: 15, marginBottom: 25, gap: 10 },
  infoText: { flex: 1, fontSize: 14, fontFamily: "sans-serif", color: COLORS.textPrimary, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  downloadBtn: { flexDirection: "row", backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 25, justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 5 },
  downloadBtnText: { fontSize: 14, fontFamily: "sans-serif", fontWeight: "bold", color: COLORS.white },
  resetBtn: { flex: 1, flexDirection: "row", backgroundColor: COLORS.white, paddingVertical: 12, borderRadius: 25, justifyContent: "center", alignItems: "center", gap: 8, elevation: 2 },
  resetBtnText: { fontSize: 16, fontFamily: "sans-serif", fontWeight: "600" },
  doneBtn: [shared.primaryButton, { flex: 1, paddingVertical: 12, borderRadius: 25 }],
  doneBtnText: [shared.primaryButtonText, { fontSize: 16 }],
});
