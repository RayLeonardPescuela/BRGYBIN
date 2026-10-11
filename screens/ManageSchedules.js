import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import {
  canViewAdminPanel,
  canAddSchedule,
  canEditSchedule,
  canDelete,
} from "../config/roles";
import shared, { COLORS } from "../styles";
import TimePickerField from "../components/TimePickerField";
import {
  syncCollectionReminders,
  cancelRemindersForSchedule,
} from "../config/reminders";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const formatDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const resetSchedule = { type: "collection", date: "", time: "", area: "", sitio: "", note: "" };

export default function ManageSchedules({ navigation }) {
  const { user, userData } = useUser();
  const canOpen = canViewAdminPanel(userData); // admin + collector
  const canAdd = canAddSchedule(userData); // admin + collector
  const canEdit = canEditSchedule(userData); // admin only
  const canDel = canDelete(userData); // admin only
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    formatDateKey(now.getFullYear(), now.getMonth(), now.getDate())
  );

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sitios, setSitios] = useState([]);

  // Add/Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [newSchedule, setNewSchedule] = useState({ ...resetSchedule });

  // Note-only modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchSitios();
  }, []);

  const fetchSchedules = async () => {
    try {
      const snapshot = await db.collection("schedules").orderBy("date", "desc").get();
      setSchedules(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.log("Error fetching schedules:", error);
    } finally {
      setLoading(false);
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

  const getSchedulesForDate = (dateKey) =>
    schedules.filter((s) => s.date === dateKey);

  const dayHasSchedule = (dateKey) =>
    schedules.some((s) => s.date === dateKey);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  // CRUD
  const openAddModal = () => {
    setEditingSchedule(null);
    setNewSchedule({ ...resetSchedule, date: selectedDate });
    setModalVisible(true);
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      type: schedule.type || "collection",
      date: schedule.date || "",
      time: schedule.time || "",
      area: schedule.area || "",
      sitio: schedule.sitio || "",
      note: schedule.note || "",
    });
    setModalVisible(true);
  };

  const saveSchedule = async () => {
    if (!newSchedule.date || !newSchedule.time) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    if (newSchedule.type === "collection" && !newSchedule.sitio) {
      Alert.alert("Error", "Please select a sitio");
      return;
    }
    if (newSchedule.type === "cleaning" && !newSchedule.area) {
      Alert.alert("Error", "Please enter an area");
      return;
    }

    try {
      const data = {
        type: newSchedule.type,
        date: newSchedule.date,
        time: newSchedule.time,
        note: newSchedule.note.trim(),
      };

      if (newSchedule.type === "collection") {
        data.sitio = newSchedule.sitio;
      } else {
        data.area = newSchedule.area;
      }

      if (editingSchedule) {
        await db.collection("schedules").doc(editingSchedule.id).update(data);
      } else {
        await db.collection("schedules").add({ ...data, status: "scheduled", createdAt: new Date() });
      }
      setModalVisible(false);
      setEditingSchedule(null);
      setNewSchedule({ ...resetSchedule });
      fetchSchedules();
      // Re-arm this device against the changed schedule set.
      syncCollectionReminders(user, userData);
    } catch (error) {
      Alert.alert("Error", "Failed to save schedule");
    }
  };

  const deleteSchedule = (id) => {
    Alert.alert("Delete Schedule", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          // Capture the sitio before deleting so we can drop its alarms.
          const target = schedules.find((s) => s.id === id);
          await db.collection("schedules").doc(id).delete();
          if (target) {
            await cancelRemindersForSchedule(id, target.sitio || "");
          }
          fetchSchedules();
          syncCollectionReminders(user, userData);
        },
      },
    ]);
  };

  // Note-only edit
  const openNoteModal = (schedule) => {
    setEditingNote(schedule);
    setNoteText(schedule.note || "");
    setNoteModalVisible(true);
  };

  const saveNote = async () => {
    if (!editingNote) return;
    setSavingNote(true);
    try {
      await db.collection("schedules").doc(editingNote.id).update({ note: noteText.trim() });
      setNoteModalVisible(false);
      setEditingNote(null);
      setNoteText("");
      fetchSchedules();
    } catch (error) {
      Alert.alert("Error", "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Calendar grid
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Schedules</Text>
        {canAdd && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.divider} />

      {!canOpen ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock" size={60} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Admin access required</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Calendar */}
          <View style={styles.calendarCard}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
                <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
                <MaterialCommunityIcons name="chevron-right" size={28} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.dayHeaders}>
              {DAYS.map((d) => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            <View style={styles.dayGrid}>{renderCalendar()}</View>
          </View>

          {/* Selected Date Label */}
          <View style={styles.dateLabelRow}>
            <Text style={styles.selectedDateLabel}>{selectedDate}</Text>
            <TouchableOpacity style={styles.addDayBtn} onPress={openAddModal}>
              <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
              <Text style={styles.addDayBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Schedules for selected day */}
          {selectedSchedules.length === 0 ? (
            <View style={styles.emptyDay}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No schedules on this day</Text>
              <Text style={styles.emptySubtext}>Tap "Add" to create one</Text>
            </View>
          ) : (
            selectedSchedules.map((item) => (
              <View key={item.id} style={styles.scheduleCard}>
                <View style={styles.scheduleIcon}>
                  <MaterialCommunityIcons
                    name={item.type === "collection" ? "truck" : "broom"}
                    size={28}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleType}>
                    {item.type === "collection" ? "Collection" : "Cleaning"}
                  </Text>
                  <Text style={styles.scheduleArea}>{item.area}</Text>
                  <Text style={styles.scheduleSitio}>Sitio: {item.sitio || "N/A"}</Text>
                  <Text style={styles.scheduleTime}>{item.time}</Text>
                  {item.note ? (
                    <View style={styles.noteContainer}>
                      <MaterialCommunityIcons name="note-text" size={14} color={COLORS.primary} />
                      <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.scheduleActions}>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? "#4CAF50" : "#FFB74D" }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                  {(canEdit || canDel) && (
                    <View style={styles.actionRow}>
                      {canEdit && (
                        <TouchableOpacity onPress={() => openEditModal(item)}>
                          <MaterialCommunityIcons name="pencil" size={20} color="#4A90E2" />
                        </TouchableOpacity>
                      )}
                      {canEdit && (
                        <TouchableOpacity onPress={() => openNoteModal(item)}>
                          <MaterialCommunityIcons name="note-edit" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                      )}
                      {canDel && (
                        <TouchableOpacity onPress={() => deleteSchedule(item.id)}>
                          <MaterialCommunityIcons name="delete" size={20} color="#E57373" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add/Edit Schedule Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingSchedule ? "Edit Schedule" : newSchedule.type === "collection" ? "Add Collection" : "Add Cleaning"}</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {["collection", "cleaning"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, newSchedule.type === t && styles.typeBtnActive]}
                    onPress={() => setNewSchedule({ ...newSchedule, type: t })}
                  >
                    <Text style={[styles.typeBtnText, newSchedule.type === t && styles.typeBtnTextActive]}>
                      {t === "collection" ? "Collection" : "Cleaning"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-09-12"
                placeholderTextColor={COLORS.textMuted}
                value={newSchedule.date}
                onChangeText={(text) => setNewSchedule({ ...newSchedule, date: text })}
              />

              <Text style={styles.label}>Time</Text>
              <TimePickerField
                value={newSchedule.time}
                onChange={(time) => setNewSchedule({ ...newSchedule, time })}
              />

              {newSchedule.type === "collection" ? (
                <>
                  <Text style={styles.label}>Sitio</Text>
                  <View style={styles.sitioRadioGroup}>
                    {sitios.length === 0 ? (
                      <Text style={styles.noSitiosText}>No sitios. Add in Manage Users first.</Text>
                    ) : (
                      <View style={styles.sitioRadioRow}>
                        {sitios.map((name, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[styles.sitioChip, newSchedule.sitio === name && styles.sitioChipActive]}
                            onPress={() => setNewSchedule({ ...newSchedule, sitio: name })}
                          >
                            <Text style={[styles.sitioChipText, newSchedule.sitio === name && styles.sitioChipTextActive]}>
                              {name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Area</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter area name"
                    placeholderTextColor={COLORS.textMuted}
                    value={newSchedule.area}
                    onChangeText={(text) => setNewSchedule({ ...newSchedule, area: text })}
                  />
                </>
              )}

              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                placeholder="Add a note..."
                placeholderTextColor={COLORS.textMuted}
                value={newSchedule.note}
                onChangeText={(text) => setNewSchedule({ ...newSchedule, note: text })}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setModalVisible(false); setEditingSchedule(null); setNewSchedule({ ...resetSchedule }); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveSchedule}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Note-Only Modal */}
      <Modal visible={noteModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setNoteModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Note</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Add a note..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNoteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveNote} disabled={savingNote}>
                {savingNote ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
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
  headerTitle: [shared.headerTitle, { marginLeft: 10, flex: 1 }],
  addBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  divider: shared.divider,
  center: shared.center,
  emptyText: shared.emptyText,
  emptySubtext: shared.emptySubtext,
  scrollContent: { paddingHorizontal: 15, paddingBottom: 40 },

  // Calendar
  calendarCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 15, marginBottom: 15, elevation: 2 },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  monthBtn: { padding: 5 },
  monthTitle: { fontSize: 18, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textDark },
  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textSecondary },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  daySelected: { backgroundColor: COLORS.primary },
  dayToday: { backgroundColor: COLORS.primaryLight },
  dayText: { fontSize: 14, fontFamily: "sans-serif", color: COLORS.textPrimary },
  dayTextSelected: { color: COLORS.white, fontWeight: "bold" },
  dayTextToday: { fontWeight: "bold", color: COLORS.primary },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 2 },
  dotSelected: { backgroundColor: COLORS.white },

  // Date label
  dateLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  selectedDateLabel: { fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif", color: COLORS.textDark },
  addDayBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addDayBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" },

  // Empty
  emptyDay: { alignItems: "center", paddingVertical: 30, gap: 6 },

  // Schedule cards
  scheduleCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: 15, padding: 15, marginBottom: 10, elevation: 2 },
  scheduleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginRight: 12 },
  scheduleInfo: { flex: 1 },
  scheduleType: { fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif" },
  scheduleArea: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "sans-serif", marginTop: 2 },
  scheduleSitio: { fontSize: 13, color: COLORS.primary, fontFamily: "sans-serif", fontWeight: "600", marginTop: 2 },
  scheduleTime: { fontSize: 12, color: COLORS.textSecondary, fontFamily: "sans-serif", marginTop: 2 },
  noteContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  noteText: { fontSize: 12, fontFamily: "sans-serif", color: COLORS.primaryDark, flex: 1 },
  scheduleActions: { alignItems: "flex-end", gap: 8 },
  actionRow: { flexDirection: "row", gap: 10 },
  statusBadge: shared.statusBadge,
  statusText: shared.statusBadgeText,

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: "85%" },
  modalTitle: { fontSize: 22, fontWeight: "bold", fontFamily: "sans-serif", marginBottom: 15, textAlign: "center" },
  label: { fontSize: 14, fontFamily: "sans-serif", marginBottom: 6, marginTop: 10, color: COLORS.textPrimary },
  input: shared.modalInput,
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.inputBg, alignItems: "center" },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeBtnText: { fontFamily: "sans-serif", color: COLORS.textPrimary },
  typeBtnTextActive: { color: COLORS.white, fontWeight: "bold" },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 15 },
  cancelBtn: { flex: 1, backgroundColor: COLORS.cancelBg, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancelBtnText: { fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: COLORS.white, fontWeight: "bold", fontFamily: "sans-serif", fontSize: 16 },

  // Sitio chips
  sitioRadioGroup: { marginBottom: 12 },
  noSitiosText: { fontSize: 13, color: COLORS.textMuted, fontFamily: "sans-serif", fontStyle: "italic" },
  sitioRadioRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sitioChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.inputBorder },
  sitioChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sitioChipText: { fontSize: 13, fontFamily: "sans-serif", color: COLORS.textPrimary },
  sitioChipTextActive: { color: COLORS.white, fontWeight: "bold" },
});
