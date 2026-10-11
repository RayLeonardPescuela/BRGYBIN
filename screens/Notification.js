import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Navbar from "../components/Navbar";
import { db, FieldValue } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canViewAdminPanel } from "../config/roles";
import { normalizeSitio } from "../config/reminders";
import shared, { COLORS } from "../styles";

/* ------------------------------------------------------------
 * READ STATE — per user, not per notification
 *
 * The old model stored ONE boolean (`read`) on the shared doc, so the
 * first resident to tap a notification marked it read for EVERYONE:
 * the badge emptied across the whole barangay and the unread styling
 * vanished for people who never opened it.
 *
 * Read state now lives in a `readBy` array; each reader appends their
 * own uid.
 *
 * Legacy docs still carry `read` and no `readBy`. Honouring
 * `read === true` keeps old broadcasts visibly read instead of
 * flipping them back to unread for everyone. No migration is needed:
 * `read` is never written again, so legacy `false` values retire on
 * their own while legacy `true` keeps applying on top. The moment
 * someone taps a legacy doc it begins tracking per-user state too.
 * ------------------------------------------------------------ */
const isRead = (notification, uid) =>
  notification.read === true ||
  (Array.isArray(notification.readBy) && notification.readBy.includes(uid));

// Mirrors what arrayUnion will do on the server, for optimistic state.
const addUnique = (list, value) =>
  Array.isArray(list) && list.includes(value) ? list : [...(list || []), value];

/* ------------------------------------------------------------
 * SITIO SCOPING
 *
 *   staff              -> the whole barangay
 *   "All Sitios"       -> empty/missing sitio, so everyone sees it
 *   a resident         -> barangay-wide plus their own sitio
 *   resident w/o sitio -> barangay-wide only (they match no specific one)
 *
 * Compared normalized, so a stray space or capital in a sitio name
 * cannot silently hide an announcement.
 * ------------------------------------------------------------ */
const visibleTo = (notification, userData) => {
  if (canViewAdminPanel(userData)) return true;

  const targeted = normalizeSitio(notification.sitio);
  if (!targeted) return true; // "All Sitios"

  const mine = normalizeSitio(userData?.sitio);
  return !!mine && targeted === mine;
};

export default function Notification({ navigation }) {
  const { user, userData } = useUser();
  const uid = user?.uid;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData !== undefined) {
      fetchNotifications();
    }
  }, [userData]);

  const fetchNotifications = async () => {
    try {
      const snapshot = await db
        .collection("notifications")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Scoped to this user's role + sitio (see visibleTo above).
      const filtered = data.filter((n) => visibleTo(n, userData));

      setNotifications(filtered.slice(0, 20));
    } catch (error) {
      console.log("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId) => {
    if (!uid) return;

    try {
      // arrayUnion appends MY uid only. Everyone else keeps their own
      // read state — this is the fix for the shared-boolean bug.
      await db
        .collection("notifications")
        .doc(notifId)
        .update({ readBy: FieldValue.arrayUnion(uid) });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, readBy: addUnique(n.readBy, uid) } : n
        )
      );
    } catch (error) {
      console.log("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!uid) return;

    const unread = notifications.filter((n) => !isRead(n, uid));
    if (unread.length === 0) return;

    try {
      // One batch instead of one write per row: up to 20 round trips
      // collapse into a single commit, and the inbox cannot be left
      // half-marked if one write fails.
      const batch = db.batch();
      unread.forEach((n) => {
        batch.update(db.collection("notifications").doc(n.id), {
          readBy: FieldValue.arrayUnion(uid),
        });
      });
      await batch.commit();

      setNotifications((prev) =>
        prev.map((n) =>
          unread.some((u) => u.id === n.id)
            ? { ...n, readBy: addUnique(n.readBy, uid) }
            : n
        )
      );
    } catch (error) {
      console.log("Error marking all as read:", error);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "collection":
        return { name: "truck-delivery", color: "#5B86E5" };
      case "cleaning":
        return { name: "broom", color: "#6B8E4E" };
      case "alert":
        return { name: "alert-octagon", color: "#EF5350" };
      case "reward":
        return { name: "medal", color: "#FFD700" };
      default:
        return { name: "bell", color: "#5B86E5" };
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const unreadCount = notifications.filter((n) => !isRead(n, uid)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="chevron-double-left"
            size={35}
            color="#4A90E2"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <View style={styles.bellContainer}>
          <MaterialCommunityIcons name="bell-badge" size={35} color="black" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>Recent</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.subHeaderText}>Mark All as Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#6B8E4E"
          style={{ marginTop: 60 }}
        />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-off-outline" size={60} color="#999" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollArea}>
          {notifications.map((item) => {
            const icon = getIcon(item.type);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  !isRead(item, uid) && styles.unreadCard,
                ]}
                onPress={() => {
                  // No write for an item this user already read.
                  if (!isRead(item, uid)) markAsRead(item.id);
                }}
              >
                <MaterialCommunityIcons
                  name={icon.name}
                  size={50}
                  color={icon.color}
                  style={styles.cardIcon}
                />
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.highlightText}>{item.message}</Text>
                  <Text style={styles.timeStamp}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
                {!isRead(item, uid) && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Navbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10, flex: 1 }],
  bellContainer: { position: "relative" },
  badge: { position: "absolute", top: -5, right: -5, backgroundColor: "#EF5350", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: COLORS.grayLine },
  subHeader: { flexDirection: "row", justifyContent: "space-between", padding: 15 },
  subHeaderText: { fontSize: 18, color: COLORS.brownDark, fontFamily: "sans-serif" },
  scrollArea: { paddingHorizontal: 15, paddingBottom: 100 },
  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontFamily: "sans-serif", color: COLORS.textMuted, marginTop: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: 15, flexDirection: "row", marginBottom: 15, elevation: 3 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardIcon: { width: 50, height: 50, marginRight: 15, resizeMode: "contain" },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "500", fontFamily: "sans-serif" },
  highlightText: { color: COLORS.brown, fontSize: 14, marginTop: 4 },
  timeStamp: { textAlign: "right", color: COLORS.brownLight, fontSize: 12, marginTop: 5 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, alignSelf: "flex-start", marginTop: 5 },
});