import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Navbar from "../components/Navbar";
import { useUser } from "../config/UserContext";
import { db } from "../config/firebase";
import shared, { COLORS } from "../styles";
import { canViewAdminPanel, roleLabel } from "../config/roles";

const defaultAnnouncements = [
  "Segregation is mandatory in our barangay!",
  "Earn points by reporting missed pickups.",
  "Community clean-up this Sunday 7AM",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Schedule dates come from a free-text field, so they may be
// "2026-06-26", "June 26", "Jun 26, 2026" or even a Firestore Date.
const parseScheduleDate = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") return value.toDate();

  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM-DD (with or without a time part)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // "June 26", "June 26, 2026", "Jun 26 2026"
  const named = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
  if (named) {
    const name = named[1].toLowerCase();
    let month = MONTH_NAMES.indexOf(name);
    if (month === -1) month = MONTH_NAMES.findIndex((m) => m.startsWith(name));
    if (month !== -1) {
      const day = +named[2];
      let year = named[3] ? +named[3] : new Date().getFullYear();
      // No year given: if that date already passed, roll to next year's occurrence
      if (!named[3] && new Date(year, month, day) < startOfToday()) year += 1;
      return new Date(year, month, day);
    }
  }

  // Fallback for other formats (e.g. 06/26/2026)
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Always display as e.g. "Jun 26" (adds the year only when it's not this one)
const formatPickupLabel = (date) => {
  const label = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? label : `${label}, ${year}`;
};

export default function Home({ navigation }) {
  const [annIndex, setAnnIndex] = useState(0);
  const { userData, loading } = useUser();
  const [nextPickup, setNextPickup] = useState("--");
  const [totalScans, setTotalScans] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [announcements, setAnnouncements] = useState(defaultAnnouncements);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 18) return "Good afternoon,";
    return "Good evening,";
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAnnIndex((prev) => (prev + 1) % announcements.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Wait until UserContext has loaded so userData.sitio is available
    if (!loading) fetchDashboardData();
  }, [loading, userData?.sitio]);

  const fetchDashboardData = async () => {
    try {
      // Fetch announcements from Firestore
      const announcementsSnapshot = await db
        .collection("announcements")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      if (!announcementsSnapshot.empty) {
        const fetched = announcementsSnapshot.docs.map((doc) => doc.data().message);
        setAnnouncements(fetched);
      }

      // Fetch next pickup: the soonest upcoming collection for the user's
      // sitio (today or later). "--" if the user has no sitio set.
      const userSitio = userData?.sitio;
      if (!userSitio) {
        setNextPickup("--");
      } else {
        const schedulesSnapshot = await db
          .collection("schedules")
          .where("type", "==", "collection")
          .where("sitio", "==", userSitio)
          .where("status", "==", "scheduled")
          .get();

        const today = startOfToday();
        const upcoming = schedulesSnapshot.docs
          .map((doc) => ({ ...doc.data() }))
          .map((schedule) => ({
            ...schedule,
            parsedDate: parseScheduleDate(schedule.date),
          }))
          .filter((schedule) => schedule.parsedDate && schedule.parsedDate >= today)
          .sort((a, b) => a.parsedDate - b.parsedDate);

        setNextPickup(
          upcoming.length > 0 ? formatPickupLabel(upcoming[0].parsedDate) : "--"
        );
      }

      // Fetch total scans (redemptions)
      const redemptionsSnapshot = await db.collection("redemptions").get();
      setTotalScans(redemptionsSnapshot.size);

      // Fetch recent activity (redemptions)
      const recentSnapshot = await db
        .collection("redemptions")
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();
      
      const activities = recentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentActivity(activities);
    } catch (error) {
      console.log("Error fetching dashboard data:", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{userData?.name || "User"}</Text>
          {canViewAdminPanel(userData) && (
            <TouchableOpacity onPress={() => navigation.navigate("AdminHome")}>
              <Text style={styles.adminBadge}>{roleLabel(userData)}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("profile")}>
          <Ionicons name="person-circle-outline" size={45} color="#3E5C3E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Announcement Banner */}
        <View style={styles.announcementBanner}>
          <MaterialCommunityIcons name="bullhorn-outline" size={24} color="#FFF" />
          <Text style={styles.announcementText}>{announcements[annIndex]}</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="star-circle" size={30} color="#FFD700" />
            <Text style={styles.statValue}>{userData?.points?.toLocaleString() || "0"}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="truck-delivery" size={30} color="#4A90E2" />
            <Text style={styles.statValue}>{nextPickup}</Text>
            <Text style={styles.statLabel}>Next Pickup</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="qrcode-scan" size={30} color="#6B8E4E" />
            <Text style={styles.statValue}>{totalScans}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("CollectionSchedule")}
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Collection{"\n"}Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("SegregationGuide")}
          >
            <MaterialCommunityIcons name="recycle" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Segregation{"\n"}Guide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("CleaningSchedule")}
          >
            <MaterialCommunityIcons name="broom" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Cleaning{"\n"}Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ComplaintFeedback")}
          >
            <MaterialCommunityIcons name="message-draw" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Complaint</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("RewardSystem")}
          >
            <MaterialCommunityIcons name="medal-outline" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Redeem{"\n"}Points</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("Notification")}
          >
            <MaterialCommunityIcons name="bell-outline" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("DeveloperKiosk")}
          >
            <MaterialCommunityIcons name="account-group" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Developers</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.length === 0 ? (
          <View style={styles.activityCard}>
            <MaterialCommunityIcons name="information" size={28} color="#999" />
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>No recent activity</Text>
              <Text style={styles.activitySub}>Scan QR codes or redeem rewards to see activity</Text>
            </View>
          </View>
        ) : (
          recentActivity.map((item) => (
            <View key={item.id} style={styles.activityCard}>
              <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{item.itemName}</Text>
                <Text style={styles.activitySub}>
                  {item.pointsSpent} points spent
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Navbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  topBar: shared.topBar,
  greeting: shared.greeting,
  userName: shared.userName,
  adminBadge: shared.adminBadge,
  scrollContent: shared.scrollContent,
  announcementBanner: shared.announcementBanner,
  announcementText: shared.announcementText,
  statsRow: shared.statsRow,
  statCard: shared.statCard,
  statValue: shared.statValue,
  statLabel: shared.statLabel,
  sectionTitle: shared.sectionTitle,
  grid: shared.grid,
  gridItem: shared.gridItem,
  gridLabel: shared.gridLabel,
  activityCard: shared.activityCard,
  activityInfo: shared.activityInfo,
  activityTitle: shared.activityTitle,
  activitySub: shared.activitySub,
});
