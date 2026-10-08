import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canDelete } from "../config/roles";
import shared, { COLORS } from "../styles";

export default function ViewComplaints({ navigation }) {
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState("complaints");
  const [complaints, setComplaints] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const complaintsSnapshot = await db.collection("complaints").orderBy("createdAt", "desc").get();
      setComplaints(complaintsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const requestsSnapshot = await db.collection("pickupRequests").orderBy("createdAt", "desc").get();
      setRequests(requestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    await db.collection("complaints").doc(complaintId).update({ status: newStatus });
    fetchAll();
  };

  const deleteComplaint = async (complaintId) => {
    Alert.alert("Delete Complaint", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await db.collection("complaints").doc(complaintId).delete();
          fetchAll();
        },
      },
    ]);
  };

  const completeRequest = async (requestId) => {
    Alert.alert("Complete Request", "Mark this pickup request as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          await db.collection("pickupRequests").doc(requestId).update({ status: "completed" });
          fetchAll();
        },
      },
    ]);
  };

  const deleteRequest = async (requestId) => {
    Alert.alert("Delete Request", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await db.collection("pickupRequests").doc(requestId).delete();
          fetchAll();
        },
      },
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "resolved":
      case "completed":
        return "#4CAF50";
      case "pending":
        return "#FFB74D";
      default:
        return "#999";
    }
  };

  const renderComplaint = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="message-alert" size={24} color="#E57373" />
        <View style={styles.cardMeta}>
          <View style={styles.userRow}>
            <Text style={styles.cardUser}>{item.userName || "Anonymous"}</Text>
            <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.primary} />
            <Text style={styles.cardSitio}>{item.sitio || "--"}</Text>
          </View>
          <Text style={styles.cardDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Unknown date"}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: "#6B8E4E20" }]}>
          <Text style={styles.typeBadgeText}>{item.type || "complaint"}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status || "pending"}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMessage}>{item.message}</Text>

      <View style={styles.cardActions}>
        {item.status !== "resolved" && (
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => updateComplaintStatus(item.id, "resolved")}
          >
            <MaterialCommunityIcons name="check-circle" size={18} color="#FFF" />
            <Text style={styles.actionBtnText}>Resolve</Text>
          </TouchableOpacity>
        )}
        {canDelete(userData) && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteComplaint(item.id)}
          >
            <MaterialCommunityIcons name="delete" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderRequest = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="truck-delivery" size={24} color="#4A90E2" />
        <View style={styles.cardMeta}>
          <Text style={styles.cardUser}>{item.userName}</Text>
          <Text style={styles.cardDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Unknown date"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="account" size={16} color="#666" />
          <Text style={styles.detailText}>{item.userName}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
          <Text style={styles.detailText}>{item.userSitio || "--"}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        {item.status !== "completed" && (
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => completeRequest(item.id)}
          >
            <MaterialCommunityIcons name="check-circle" size={18} color="#FFF" />
            <Text style={styles.actionBtnText}>Complete</Text>
          </TouchableOpacity>
        )}
        {canDelete(userData) && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteRequest(item.id)}
          >
            <MaterialCommunityIcons name="delete" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaints & Requests</Text>
      </View>
      <View style={styles.divider} />

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "complaints" && styles.activeTab]}
          onPress={() => setActiveTab("complaints")}
        >
          <MaterialCommunityIcons
            name="message-alert"
            size={20}
            color={activeTab === "complaints" ? "#FFF" : "#333"}
          />
          <Text style={[styles.tabText, activeTab === "complaints" && styles.activeTabText]}>
            Complaints ({complaints.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "requests" && styles.activeTab]}
          onPress={() => setActiveTab("requests")}
        >
          <MaterialCommunityIcons
            name="truck-delivery"
            size={20}
            color={activeTab === "requests" ? "#FFF" : "#333"}
          />
          <Text style={[styles.tabText, activeTab === "requests" && styles.activeTabText]}>
            Requests ({requests.filter((r) => r.status === "pending").length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : activeTab === "complaints" ? (
        complaints.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="message-check" size={60} color="#6B8E4E" />
            <Text style={styles.loadingText}>No complaints yet</Text>
          </View>
        ) : (
          <FlatList
            data={complaints}
            keyExtractor={(item) => item.id}
            renderItem={renderComplaint}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="truck-check" size={60} color="#6B8E4E" />
          <Text style={styles.loadingText}>No pickup requests yet</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
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
  headerTitle: [shared.headerTitle, { fontSize: 24, marginLeft: 10 }],
  divider: shared.divider,
  tabRow: shared.tabRow,
  tab: shared.tab,
  activeTab: shared.tabActive,
  tabText: [shared.tabText, { fontSize: 14 }],
  activeTabText: shared.tabTextActive,
  center: shared.center,
  loadingText: shared.loadingText,
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  card: [shared.card, { marginBottom: 12 }],
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardMeta: { flex: 1, marginLeft: 10 },
  cardUser: { fontSize: 15, fontWeight: "bold", fontFamily: "sans-serif" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap" },
  cardSitio: { fontSize: 13, color: COLORS.primary, fontFamily: "sans-serif", fontWeight: "600" },
  cardDate: { fontSize: 12, color: COLORS.textSecondary, fontFamily: "sans-serif" },
  statusBadge: shared.statusBadge,
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: "bold", color: COLORS.primary, textTransform: "capitalize" },
  statusText: shared.statusBadgeText,
  cardTitle: { fontSize: 16, fontFamily: "sans-serif", fontWeight: "bold", marginBottom: 6 },
  cardMessage: { fontSize: 15, fontFamily: "sans-serif", color: COLORS.textPrimary, lineHeight: 22, marginBottom: 12 },
  requestDetails: { backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textPrimary },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  resolveBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, gap: 5 },
  actionBtnText: { color: COLORS.white, fontSize: 12, fontWeight: "bold", fontFamily: "sans-serif" },
  deleteBtn: { backgroundColor: COLORS.error, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15 },
});
