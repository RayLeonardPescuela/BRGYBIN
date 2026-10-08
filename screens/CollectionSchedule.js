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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canEditSchedule, canDelete } from "../config/roles";
import shared, { COLORS } from "../styles";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const formatDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function CollectionSchedule({ navigation }) {
  const { user, userData } = useUser();
  // Edit + delete on schedules is Main Admin only (collectors can't change these)
  const canManage = canEditSchedule(userData) || canDelete(userData);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  // Request modal
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestTime, setRequestTime] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [sitios, setSitios] = useState([]);
  const [requestSitio, setRequestSitio] = useState("");
  const [sitioModalVisible, setSitioModalVisible] = useState(false);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (userData !== undefined) {
      fetchSchedules();
      checkPendingRequest();
      fetchSitios();
    }
  }, [userData]);

  const fetchSchedules = async () => {
    try {
      const snapshot = await db
        .collection("schedules")
        .where("type", "==", "collection")
        .get();
      const scheduleList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const userSitio = userData?.sitio;
      const filtered = userSitio
        ? scheduleList.filter((s) => s.sitio === userSitio)
        : scheduleList;
      setSchedules(filtered);
    } catch (error) {
      console.log("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequest = async () => {
    if (!user) return;
    try {
      const snapshot = await db
        .collection("pickupRequests")
        .where("userId", "==", user.uid)
        .where("status", "==", "pending")
        .get();
      setHasPendingRequest(!snapshot.empty);
    } catch (error) {
      console.log("Error checking request:", error);
    }
  };

  const fetchSitios = async () => {
    try {
      const doc = await db.collection("config").doc("sitios").get();
      if (doc.exists) setSitios(doc.data().names || []);
    } catch (error) {
      console.log("Error fetching sitios:", error);
    }
  };

  const openRequestModal = () => {
    if (hasPendingRequest) {
      Alert.alert("Already Requested", "You already have a pending pickup request.");
      return;
    }
    setRequestTime("");
    setRequestDate(selectedDate);
    setRequestSitio(userData?.sitio || "");
    setRequestMessage("");
    setRequestModalVisible(true);
  };

  const submitPickupRequest = async () => {
    if (!requestTime.trim()) {
      Alert.alert("Error", "Please enter a time");
      return;
    }
    if (!requestDate.trim()) {
      Alert.alert("Error", "Please enter a date");
      return;
    }
    if (!requestSitio) {
      Alert.alert("Error", "Please select a sitio");
      return;
    }

    setRequestLoading(true);
    try {
      await db.collection("pickupRequests").add({
        userId: user.uid,
        userName: userData?.name || "Unknown",
        userSitio: requestSitio,
        time: requestTime.trim(),
        date: requestDate.trim(),
        message: requestMessage.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setHasPendingRequest(true);
      setRequestModalVisible(false);
      Alert.alert("Request Sent", "Your pickup request has been sent.");
    } catch (error) {
      Alert.alert("Error", "Failed to send request.");
    } finally {
      setRequestLoading(false);
    }
  };

  // Get schedules for a specific date
  const getSchedulesForDate = (dateKey) =>
    schedules.filter((s) => s.date === dateKey);

  // Check if a day has schedules (for dots)
  const dayHasSchedule = (dateKey) =>
    schedules.some((s) => s.date === dateKey);

  // Prev / Next month
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Edit schedule note
  const openEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setNoteText(schedule.note || "");
    setEditModalVisible(true);
  };

  const saveScheduleNote = async () => {
    if (!editingSchedule) return;
    setSavingNote(true);
    try {
      await db.collection("schedules").doc(editingSchedule.id).update({
        note: noteText.trim(),
      });
      setEditModalVisible(false);
      setEditingSchedule(null);
      setNoteText("");
      fetchSchedules();
    } catch (error) {
      Alert.alert("Error", "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Delete schedule
  const deleteSchedule = (scheduleId) => {
    Alert.alert("Delete Schedule", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await db.collection("schedules").doc(scheduleId).delete();
            fetchSchedules();
          } catch (error) {
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  // Render calendar grid
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const cells = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentYear, currentMonth, day);
      const isSelected = dateKey === selectedDate;
      const isToday = dateKey === today;
      const hasSchedule = dayHasSchedule(dateKey);

      cells.push(
        <TouchableOpacity
          key={day}
          style={[styles.dayCell, isSelected && styles.daySelected, isToday && styles.dayToday]}
          onPress={() => setSelectedDate(dateKey)}
        >
          <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayTextToday]}>
            {day}
          </Text>
          {hasSchedule && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
        </TouchableOpacity>
      );
    }

    return cells;
  };

  const selectedSchedules = getSchedulesForDate(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-circle" size={40} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collection Schedule</Text>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B8E4E" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Calendar */}
          <View style={styles.calendarCard}>
            {/* Month Navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
                <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
                <MaterialCommunityIcons name="chevron-right" size={28} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Day Headers */}
            <View style={styles.dayHeaders}>
              {DAYS.map((d) => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Day Grid */}
            <View style={styles.dayGrid}>{renderCalendar()}</View>
          </View>

          {/* Selected Date Label */}
          <Text style={styles.selectedDateLabel}>
            Schedules for {selectedDate}
          </Text>

          {/* Schedules for selected day */}
          {selectedSchedules.length === 0 ? (
            <View style={styles.emptyDay}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No collection schedule</Text>
              <Text style={styles.emptySubtext}>Admin can add schedules from Manage Schedules</Text>
            </View>
          ) : (
            selectedSchedules.map((item) => (
              <View key={item.id} style={styles.scheduleCard}>
                <View style={styles.scheduleIcon}>
                  <MaterialCommunityIcons name="truck" size={28} color={COLORS.white} />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTitle}>{item.area || "Collection"}</Text>
                  <Text style={styles.scheduleTime}>{item.time || "All day"}</Text>
                  <Text style={styles.scheduleSitio}>Sitio: {item.sitio || "N/A"}</Text>
                  {item.note ? (
                    <View style={styles.noteContainer}>
                      <MaterialCommunityIcons name="note-text" size={16} color={COLORS.primary} />
                      <Text style={styles.noteText}>{item.note}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.scheduleActions}>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? "#4CAF50" : "#4A90E2" }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                  {canManage && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity onPress={() => openEditSchedule(item)}>
                        <MaterialCommunityIcons name="pencil" size={20} color="#4A90E2" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteSchedule(item.id)}>
                        <MaterialCommunityIcons name="delete" size={20} color="#E57373" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Pickup Request Button */}
      <TouchableOpacity
        style={[styles.pickupButton, hasPendingRequest && styles.pickupButtonPending]}
        onPress={openRequestModal}
        disabled={requestLoading}
      >
        {requestLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : hasPendingRequest ? (
          <>
            <MaterialCommunityIcons name="check-circle" size={24} color="#FFF" />
            <Text style={styles.pickupButtonText}>Request Sent</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFF" />
            <Text style={styles.pickupButtonText}>Pickup Request</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Pickup Request Modal */}
      <Modal visible={requestModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRequestModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pickup Request</Text>

            <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="2026-09-12"
              placeholderTextColor={COLORS.textMuted}
              value={requestDate}
              onChangeText={setRequestDate}
            />

            <Text style={styles.modalLabel}>Time (e.g., 8:00 AM)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter time"
              placeholderTextColor={COLORS.textMuted}
              value={requestTime}
              onChangeText={setRequestTime}
            />

            <Text style={styles.modalLabel}>Sitio</Text>
            <TouchableOpacity
              style={styles.sitioPicker}
              onPress={() => setSitioModalVisible(true)}
            >
              <Text style={[styles.sitioPickerText, !requestSitio && { color: COLORS.textMuted }]}>
                {requestSitio || "Select Sitio"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Message (optional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]}
              placeholder="Add a message..."
              placeholderTextColor={COLORS.textMuted}
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRequestModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, requestLoading && { opacity: 0.6 }]}
                onPress={submitPickupRequest}
                disabled={requestLoading}
              >
                {requestLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sitio Picker Modal */}
      <Modal visible={sitioModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSitioModalVisible(false)} />
          <View style={styles.sitioModalContent}>
            <View style={styles.sitioModalHeader}>
              <Text style={styles.sitioModalTitle}>Select Sitio</Text>
              <TouchableOpacity onPress={() => setSitioModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={26} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {sitios.length === 0 ? (
              <View style={styles.sitioModalEmpty}>
                <Text style={styles.sitioModalEmptyText}>No sitios available</Text>
              </View>
            ) : (
              <FlatList
                data={sitios}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.sitioModalOption, requestSitio === item && styles.sitioModalOptionActive]}
                    onPress={() => {
                      setRequestSitio(item);
                      setSitioModalVisible(false);
                    }}
                  >
                    <View style={styles.radioCircle}>
                      {requestSitio === item && <View style={styles.radioSelected} />}
                    </View>
                    <Text style={[styles.sitioModalOptionText, requestSitio === item && styles.sitioModalOptionTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Note Modal */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Schedule Note</Text>
            <Text style={styles.modalLabel}>Note</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Add a note for this schedule..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingNote && { opacity: 0.6 }]}
                onPress={saveScheduleNote}
                disabled={savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
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
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  divider: shared.divider,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  scrollContent: { paddingHorizontal: 15, paddingBottom: 100 },

  // Calendar
  calendarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthBtn: { padding: 5 },
  monthTitle: { fontSize: 18, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textDark },
  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.textSecondary,
  },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  daySelected: { backgroundColor: COLORS.primary },
  dayToday: { backgroundColor: COLORS.primaryLight },
  dayText: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textPrimary },
  dayTextSelected: { color: COLORS.white, fontWeight: "bold" },
  dayTextToday: { fontWeight: "bold", color: COLORS.primary },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 2,
  },
  dotSelected: { backgroundColor: COLORS.white },

  // Selected date label
  selectedDateLabel: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.textDark,
    marginBottom: 12,
  },

  // Empty day
  emptyDay: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 6,
  },

  // Schedule cards
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  scheduleInfo: { flex: 1 },
  scheduleTitle: { fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif" },
  scheduleTime: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "sans-serif", marginTop: 2 },
  scheduleSitio: { fontSize: 13, color: COLORS.primary, fontFamily: "sans-serif", fontWeight: "600", marginTop: 2 },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  noteText: { fontSize: 12, fontFamily: "sans-serif", color: COLORS.primaryDark, flex: 1 },
  scheduleActions: { alignItems: "flex-end", gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: "bold", color: COLORS.white, fontFamily: "sans-serif", textTransform: "capitalize" },
  adminActions: { flexDirection: "row", gap: 12 },

  // Pickup button
  pickupButton: { flexDirection: "row", backgroundColor: COLORS.primaryDark, margin: 20, padding: 15, borderRadius: 30, justifyContent: "center", alignItems: "center", gap: 10 },
  pickupButtonPending: { backgroundColor: COLORS.secondary },
  pickupButtonText: { color: COLORS.white, fontSize: 20, fontFamily: "sans-serif" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "center", paddingHorizontal: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 20, padding: 25, zIndex: 1 },
  modalTitle: { fontSize: 22, fontWeight: "bold", fontFamily: "sans-serif", marginBottom: 15, textAlign: "center" },
  modalLabel: { fontSize: 14, fontFamily: "sans-serif", marginBottom: 6, color: COLORS.textPrimary },
  modalInput: { backgroundColor: COLORS.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "sans-serif", marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, gap: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: COLORS.cancelBg, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  modalCancelText: { fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
  modalSaveBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  modalSaveText: { color: COLORS.white, fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },

  // Sitio picker
  sitioPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  sitioPickerText: { fontSize: 15, fontFamily: "sans-serif", color: COLORS.textPrimary },

  // Sitio picker modal
  sitioModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: "50%",
  },
  sitioModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    marginBottom: 5,
  },
  sitioModalTitle: { fontSize: 20, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textDark },
  sitioModalEmpty: { alignItems: "center", paddingVertical: 40 },
  sitioModalEmptyText: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textMuted },
  sitioModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  sitioModalOptionActive: { backgroundColor: COLORS.primaryLight },
  sitioModalOptionText: { fontSize: 16, fontFamily: "sans-serif", color: COLORS.textDark },
  sitioModalOptionTextActive: { fontWeight: "bold", color: COLORS.primary },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  radioSelected: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
});
