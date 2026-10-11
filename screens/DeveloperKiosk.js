import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import shared, { COLORS } from "../styles";
import { useUser } from "../config/UserContext";
import {
  scheduleTestReminder,
  syncCollectionReminders,
  cancelAllLocalReminders,
  resolveDeliveryMode,
} from "../config/reminders";
import * as Notifications from "expo-notifications";

const developers = [
  {
    name: "Ray Leonard Pescuela",
    role: "Assistant Developer",
    icon: "code-tags",
  },
  {
    name: "Frankie Bayaton",
    role: "UI/UX Designer",
    icon: "palette",
  },
  {
    name: "Bless Abegail Antemaro",
    role: "Lead Developer",
    icon: "crown",
    isCenter: true,
  },
  {
    name: "Gea Aranduque",
    role: "Assistant UI/UX Designer",
    icon: "brush",
  },
  {
    name: "Rogelio Antepuesto Jr.",
    role: "Tester",
    icon: "bug-check",
  },
];

export default function DeveloperKiosk({ navigation }) {
  const { user, userData } = useUser();
  const [armed, setArmed] = useState(0);

  const refreshArmed = async () => {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      setArmed(all.length);
    } catch (error) {
      setArmed(0);
    }
  };

  useEffect(() => {
    refreshArmed();
  }, []);

  const onTest = async () => {
    const ok = await scheduleTestReminder(60);
    Alert.alert(
      ok ? "Test scheduled" : "Blocked",
      ok
        ? "Fires in 60 seconds. Kill the app now to prove the alarm survives."
        : "Notification permission is not granted."
    );
    refreshArmed();
  };

  const onSync = async () => {
    const result = await syncCollectionReminders(user, userData);
    Alert.alert(
      "Synced",
      `Mode: ${result.mode}\nArmed: ${result.scheduled}` +
        (result.reason ? `\nSkipped: ${result.reason}` : "")
    );
    refreshArmed();
  };

  const onCancel = async () => {
    await cancelAllLocalReminders();
    Alert.alert("Cancelled", "All local alarms cleared.");
    refreshArmed();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="chevron-double-left"
            size={35}
            color="#4A90E2"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Developers</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Meet the Team</Text>
        <Text style={styles.pageSubTitle}>BRGY BIN Development Team</Text>

        <View style={styles.teamContainer}>
          {developers.map((dev, index) => (
            <View
              key={index}
              style={[
                styles.devCard,
                dev.isCenter && styles.devCardCenter,
              ]}
            >
              <View
                style={[
                  styles.avatarCircle,
                  dev.isCenter && styles.avatarCircleCenter,
                ]}
              >
                <MaterialCommunityIcons
                  name={dev.icon}
                  size={dev.isCenter ? 40 : 30}
                  color={dev.isCenter ? "#FFD700" : "#FFF"}
                />
              </View>
              {dev.isCenter && <Text style={styles.crownBadge}>★</Text>}
              <Text
                style={[
                  styles.devName,
                  dev.isCenter && styles.devNameCenter,
                ]}
              >
                {dev.name}
              </Text>
              <Text
                style={[
                  styles.devRole,
                  dev.isCenter && styles.devRoleCenter,
                ]}
              >
                {dev.role}
              </Text>
            </View>
          ))}
        </View>

        {/* Dev-only reminder diagnostics (Phase 2 checkpoint) */}
        <View style={styles.devToolBox}>
          <Text style={styles.devToolTitle}>Reminder diagnostics</Text>
          <Text style={styles.devToolStatus}>
            {armed} alarm(s) armed · mode: {resolveDeliveryMode()}
          </Text>

          <View style={styles.devToolRow}>
            <TouchableOpacity style={styles.devToolBtn} onPress={onTest}>
              <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#FFF" />
              <Text style={styles.devToolBtnText}>Test 60s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devToolBtn} onPress={onSync}>
              <MaterialCommunityIcons name="sync" size={18} color="#FFF" />
              <Text style={styles.devToolBtnText}>Sync now</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.devToolBtnWide} onPress={onCancel}>
            <MaterialCommunityIcons name="bell-cancel-outline" size={18} color="#FFF" />
            <Text style={styles.devToolBtnText}>Cancel all alarms</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerBox}>
          <MaterialCommunityIcons name="leaf" size={20} color="#6B8E4E" />
          <Text style={styles.footerText}>BRGY BIN © 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  scrollContent: shared.scrollContentSmall,
  pageTitle: { fontSize: 28, fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center", marginTop: 10, color: COLORS.textDark },
  pageSubTitle: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textSecondary, textAlign: "center", marginBottom: 25 },
  teamContainer: { alignItems: "center", gap: 15 },
  devCard: { backgroundColor: COLORS.white, borderRadius: 20, paddingVertical: 20, paddingHorizontal: 25, alignItems: "center", width: "100%", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  devCardCenter: { backgroundColor: COLORS.primaryDark, paddingVertical: 28, elevation: 4 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarCircleCenter: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#2E4A2E" },
  crownBadge: { fontSize: 24, color: COLORS.gold, marginBottom: 5 },
  devName: { fontSize: 17, fontFamily: "sans-serif", fontWeight: "bold", color: COLORS.textPrimary, textAlign: "center" },
  devNameCenter: { fontSize: 22, color: COLORS.white },
  devRole: { fontSize: 13, fontFamily: "sans-serif", color: COLORS.brownLight, marginTop: 3, textAlign: "center" },
  devRoleCenter: { fontSize: 15, color: COLORS.background },
  footerBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 30, paddingVertical: 15, backgroundColor: COLORS.white, borderRadius: 15 },
  footerText: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textSecondary },
  devToolBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: 18, width: "100%", elevation: 2, marginTop: 20 },
  devToolTitle: { fontSize: 15, fontFamily: "sans-serif", fontWeight: "bold", color: COLORS.textPrimary, marginBottom: 4 },
  devToolStatus: { fontSize: 13, fontFamily: "sans-serif", color: COLORS.textSecondary, marginBottom: 12 },
  devToolRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  devToolBtn: { flex: 1, flexDirection: "row", backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  devToolBtnWide: { flexDirection: "row", backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  devToolBtnText: { color: COLORS.white, fontFamily: "sans-serif", fontWeight: "bold", fontSize: 14 },
});
