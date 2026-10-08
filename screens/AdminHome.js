import React, { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useUser } from "../config/UserContext";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../config/firebase";
import shared, { COLORS } from "../styles";
import { canViewAdminPanel, roleLabel } from "../config/roles";

export default function AdminHome({ navigation }) {
  const { userData } = useUser();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    pendingRequests: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchRecentComplaints();
    }, [])
  );

  const fetchStats = async () => {
    try {
      const usersSnapshot = await db.collection("users").get();
      const complaintsSnapshot = await db.collection("complaints").get();
      const requestsSnapshot = await db.collection("pickupRequests").where("status", "==", "pending").get();

      let pendingCount = 0;
      complaintsSnapshot.docs.forEach((doc) => {
        if (doc.data().status === "pending") pendingCount++;
      });

      setStats({
        totalUsers: usersSnapshot.size,
        totalComplaints: complaintsSnapshot.size,
        pendingComplaints: pendingCount,
        pendingRequests: requestsSnapshot.size,
      });
    } catch (error) {
      console.log("Error fetching stats:", error);
    }
  };

  const fetchRecentComplaints = async () => {
    try {
      const snapshot = await db
        .collection("complaints")
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentComplaints(data);
    } catch (error) {
      console.log("Error fetching recent complaints:", error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 18) return "Good afternoon,";
    return "Good evening,";
  };

  // Only Main Admin / Collector may open this panel
  if (userData && !canViewAdminPanel(userData)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <MaterialCommunityIcons name="lock" size={60} color="#999" />
          <Text style={{ fontSize: 16, marginTop: 10, color: "#666" }}>
            Admin access required
          </Text>
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
          <Text style={styles.userName}>{userData?.name || "Admin"}</Text>
          <Text style={styles.roleBadge}>{roleLabel(userData)}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("profile")}>
          <Ionicons name="person-circle-outline" size={45} color="#3E5C3E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Cards */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: "#4A90E2" }]}>
            <MaterialCommunityIcons name="account-group" size={30} color="#FFF" />
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#E57373" }]}>
            <MaterialCommunityIcons name="message-alert" size={30} color="#FFF" />
            <Text style={styles.statValue}>{stats.pendingComplaints}</Text>
            <Text style={styles.statLabel}>Pending{"\n"}Complaints</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#FFB74D" }]}>
            <MaterialCommunityIcons name="truck-delivery" size={30} color="#FFF" />
            <Text style={styles.statValue}>{stats.pendingRequests}</Text>
            <Text style={styles.statLabel}>Pickup{"\n"}Requests</Text>
          </View>
        </View>

        {/* Admin Actions */}
        <Text style={styles.sectionTitle}>Admin Actions</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ManageUsers")}
          >
            <MaterialCommunityIcons name="account-cog" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Manage{"\n"}Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ManageSchedules")}
          >
            <MaterialCommunityIcons name="calendar-edit" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Manage{"\n"}Schedules</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ViewComplaints")}
          >
            <MaterialCommunityIcons name="message-text-clock" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Complaints{"\n"}& Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ManageRewards")}
          >
            <MaterialCommunityIcons name="gift" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Manage{"\n"}Rewards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("CreateNotification")}
          >
            <MaterialCommunityIcons name="bell-ring" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Send{"\n"}Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("ManageAnnouncements")}
          >
            <MaterialCommunityIcons name="bullhorn" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>Manage{"\n"}Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate("Home")}
          >
            <MaterialCommunityIcons name="eye" size={36} color="#FFF" />
            <Text style={styles.gridLabel}>View{"\n"}User</Text>
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
        <Text style={styles.sectionTitle}>Recent Complaints</Text>
        {recentComplaints.length === 0 ? (
          <View style={styles.activityCard}>
            <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>No complaints</Text>
              <Text style={styles.activitySub}>All clear!</Text>
            </View>
          </View>
        ) : (
          recentComplaints.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.activityCard}
              onPress={() => navigation.navigate("ViewComplaints")}
            >
              <MaterialCommunityIcons name="alert-circle" size={28} color="#E57373" />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{item.title || item.message?.substring(0, 30)}</Text>
                <Text style={styles.activitySub}>{item.userName} - {new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: item.status === "resolved" ? "#4CAF50" : "#FFB74D" }]} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  topBar: shared.topBar,
  greeting: shared.greeting,
  userName: shared.userName,
  roleBadge: shared.roleBadge,
  scrollContent: shared.scrollContentSmall,
  sectionTitle: [shared.sectionTitle, { marginTop: 10 }],
  statsRow: shared.statsRow,
  statCard: shared.statCard,
  statValue: [shared.statValue, { fontSize: 24, color: COLORS.white }],
  statLabel: [shared.statLabel, { fontSize: 11, color: COLORS.white, textAlign: "center" }],
  grid: shared.grid,
  gridItem: shared.gridItem,
  gridLabel: [shared.gridLabel, { fontSize: 13, lineHeight: 17 }],
  activityCard: shared.activityCard,
  activityInfo: shared.activityInfo,
  activityTitle: shared.activityTitle,
  activitySub: shared.activitySub,
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
