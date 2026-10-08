import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Navbar from "../components/Navbar";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canEditSchedule, canDelete } from "../config/roles";
import shared, { COLORS } from "../styles";

const colors = [
  { bgColor: "#3E5C3E", iconColor: "#A8D5BA" },
  { bgColor: "#6B8E4E", iconColor: "#FFD700" },
  { bgColor: "#2D5A3D", iconColor: "#87CEEB" },
  { bgColor: "#4A7C59", iconColor: "#FFB6C1" },
  { bgColor: "#5C7A3E", iconColor: "#98FB98" },
];

export default function CleaningSchedule({ navigation }) {
  const { userData } = useUser();
  // Edit + delete on cleaning schedules is Main Admin only
  const canManage = canEditSchedule(userData) || canDelete(userData);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editArea, setEditArea] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData !== undefined) {
      fetchSchedules();
    }
  }, [userData]);

  const fetchSchedules = async () => {
    try {
      const snapshot = await db
        .collection("schedules")
        .where("type", "==", "cleaning")
        .get();
      const scheduleList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        ...doc.data(),
        colorIndex: index % colors.length,
      }));
      setSchedules(scheduleList);
    } catch (error) {
      console.log("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = (id) => {
    Alert.alert("Delete Schedule", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await db.collection("schedules").doc(id).delete();
            fetchSchedules();
          } catch (error) {
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setEditArea(schedule.area || "");
    setEditDate(schedule.date || "");
    setEditTime(schedule.time || "");
    setEditNote(schedule.note || "");
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editArea.trim() || !editDate.trim() || !editTime.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      await db.collection("schedules").doc(editingSchedule.id).update({
        area: editArea.trim(),
        date: editDate.trim(),
        time: editTime.trim(),
        note: editNote.trim(),
      });
      setEditModalVisible(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (error) {
      Alert.alert("Error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const getAlign = (index) => (index % 2 === 0 ? "left" : "right");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cleaning Schedule</Text>
        </View>
        <View style={styles.divider} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : schedules.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="broom" size={60} color="#999" />
          <Text style={styles.emptyText}>No cleaning schedules yet</Text>
          <Text style={styles.emptySubtext}>Admin can add schedules from the admin panel</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.taskList}
        >
          {schedules.map((item, index) => {
            const colorSet = colors[item.colorIndex];
            const isLeft = getAlign(index) === "left";
            return (
              <View
                key={item.id}
                style={[
                  styles.circleContainer,
                  isLeft ? styles.alignLeft : styles.alignRight,
                ]}
              >
                <View
                  style={[
                    styles.taskCircle,
                    { backgroundColor: colorSet.bgColor },
                  ]}
                >
                  <View style={styles.areaTag}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={colorSet.iconColor} />
                    <Text style={[styles.areaText, { color: colorSet.iconColor }]}>
                      {item.area}
                    </Text>
                  </View>

                  <View style={styles.iconRow}>
                    <MaterialCommunityIcons name="broom" size={36} color={colorSet.iconColor} />
                  </View>

                  <Text style={styles.scheduleLabel}>Cleaning Day</Text>

                  <View style={styles.timeRow}>
                    <MaterialCommunityIcons name="calendar" size={14} color="#FFF" />
                    <Text style={styles.timeText}>{item.date}</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#FFF" />
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                  {canManage && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity onPress={() => openEditModal(item)}>
                        <MaterialCommunityIcons name="pencil" size={18} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteSchedule(item.id)}>
                        <MaterialCommunityIcons name="delete" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Navbar />

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Cleaning Schedule</Text>

            <Text style={styles.modalLabel}>Area</Text>
            <TextInput
              style={styles.modalInput}
              value={editArea}
              onChangeText={setEditArea}
              placeholder="Enter area"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-09-12"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>Time</Text>
            <TextInput
              style={styles.modalInput}
              value={editTime}
              onChangeText={setEditTime}
              placeholder="Enter time"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>Note (optional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Add a note..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  headerContainer: { paddingTop: 40, backgroundColor: COLORS.background, zIndex: 10 },
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  taskList: { paddingTop: 20, paddingBottom: 90 },
  circleContainer: { marginVertical: 15 },
  alignLeft: { alignItems: "flex-start", paddingLeft: 20 },
  alignRight: { alignItems: "flex-end", paddingRight: 20 },
  taskCircle: { width: 220, height: 220, borderRadius: 110, justifyContent: "center", alignItems: "center", padding: 20, overflow: "hidden", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4 },
  areaTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 },
  areaText: { fontSize: 11, fontWeight: "bold", fontFamily: "sans-serif" },
  iconRow: { marginBottom: 5 },
  scheduleLabel: { color: COLORS.white, fontSize: 11, fontFamily: "sans-serif", fontWeight: "600", marginBottom: 5, textAlign: "center" },
  adminActions: { flexDirection: "row", gap: 12, marginTop: 8, justifyContent: "center" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  timeText: { color: COLORS.white, fontSize: 9, fontFamily: "sans-serif" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "center", paddingHorizontal: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 20, padding: 25, zIndex: 1 },
  modalTitle: { fontSize: 22, fontWeight: "bold", fontFamily: "sans-serif", marginBottom: 15, textAlign: "center" },
  modalLabel: { fontSize: 14, fontFamily: "sans-serif", marginBottom: 6, color: COLORS.textPrimary },
  modalInput: { backgroundColor: COLORS.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "sans-serif", marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, gap: 15 },
  cancelBtn: { flex: 1, backgroundColor: COLORS.cancelBg, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancelBtnText: { fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: COLORS.white, fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
});
