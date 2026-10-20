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
import NotificationBadge from "../components/NotificationBadge";
import { useUser } from "../config/UserContext";
import { useUnreadCount } from "../config/unreadNotifications";
import { db } from "../config/firebase";
import { countDocs } from "../config/counts";
import shared, { COLORS } from "../styles";
import { canViewAdminPanel, roleLabel } from "../config/roles";
// Shared with the reminder scheduler so the dashboard's "next pickup"
// and the T-10/T-5 alarms can never disagree about a collection's date.
import { parseScheduleDate, formatPickupLabel, startOfToday } from "../config/reminders";

const defaultAnnouncements = [
  "Segregation is mandatory in our barangay!",
  "Earn points by reporting missed pickups.",
  "Community clean-up this Sunday 7AM",
];

// Date parsing (MONTH_ABBR, MONTH_NAMES, startOfToday, parseScheduleDate,
// formatPickupLabel) now lives in config/reminders.js so the dashboard and
// the reminder scheduler share one source of truth. See imports above.

export default function Home({ navigation }) {
  const [annIndex, setAnnIndex] = useState(0);
  const { userData, loading } = useUser();
  const [nextPickup, setNextPickup] = useState("--");
  const [totalScans, setTotalScans] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [announcements, setAnnouncements] = useState(defaultAnnouncements);

  // Unread badge on the notification bell. Counts exactly the set the
  // inbox can display, so "Mark all as read" always empties it.
  const { count: unreadCount } = useUnreadCount();

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
      const userSitio = userData?.sitio;

      // Four independent reads, fired together instead of back to back:
      // the dashboard used to pay for four separate round trips before
      // anything appeared on screen. The "no sitio" case simply skips
      // the schedules query, because it has nothing to look up.
      const [announcementsSnapshot, schedulesSnapshot, redemptionCount, recentSnapshot] =
        await Promise.all([
          db
            .collection("announcements")
            .orderBy("createdAt", "desc")
            .limit(10)
            .get(),
          userSitio
            ? db
                .collection("schedules")
                .where("type", "==", "collection")
                .where("sitio", "==", userSitio)
                .where("status", "==", "scheduled")
                .get()
            : null,
          // Counted server-side — see config/counts.js. Downloading the
          // whole redemptions collection just to read `.size` off it
          // grows more expensive every time someone redeems a reward.
          countDocs("redemptions"),
          db
            .collection("redemptions")
            .orderBy("createdAt", "desc")
            .limit(3)
            .get(),
        ]);

      // Fetch announcements from Firestore
      if (!announcementsSnapshot.empty) {
        const fetched = announcementsSnapshot.docs.map((doc) => doc.data().message);
        setAnnouncements(fetched);
      }

      // Next pickup: the soonest upcoming collection for the user's
      // sitio (today or later). "--" if the user has no sitio set.
      if (!userSitio) {
        setNextPickup("--");
      } else {
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

      // Total scans (redemptions)
      setTotalScans(redemptionCount);

      // Recent activity (redemptions)
      setRecentActivity(
        recentSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
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
            <View style={styles.bellIconWrap}>
              <MaterialCommunityIcons name="bell-outline" size={36} color="#FFF" />
              <NotificationBadge count={unreadCount} />
            </View>
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
  // Anchors the badge to the icon's corner. Sized to the icon so the
  // absolute offset is measured from the bell, not the whole tile.
  bellIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCard: shared.activityCard,
  activityInfo: shared.activityInfo,
  activityTitle: shared.activityTitle,
  activitySub: shared.activitySub,
});
