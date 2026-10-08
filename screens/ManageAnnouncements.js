import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canWriteContent } from "../config/roles";
import shared, { COLORS } from "../styles";

export default function ManageAnnouncements({ navigation }) {
  const { userData } = useUser();
  const canWrite = canWriteContent(userData); // Main Admin only (collectors = view only)
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const snapshot = await db
        .collection("announcements")
        .orderBy("createdAt", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAnnouncements(data);
    } catch (error) {
      console.log("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveAnnouncement = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter a message");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await db.collection("announcements").doc(editingId).update({
          message: message.trim(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.collection("announcements").add({
          message: message.trim(),
          createdBy: userData?.name || "Admin",
          createdAt: new Date().toISOString(),
        });
      }

      Alert.alert("Success", editingId ? "Announcement updated!" : "Announcement added!");
      setMessage("");
      setShowForm(false);
      setEditingId(null);
      fetchAnnouncements();
    } catch (error) {
      console.log("Error saving:", error);
      Alert.alert("Error", "Failed to save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAnnouncement = (id) => {
    Alert.alert("Delete", "Remove this announcement?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await db.collection("announcements").doc(id).delete();
          fetchAnnouncements();
        },
      },
    ]);
  };

  const editAnnouncement = (item) => {
    setMessage(item.message);
    setEditingId(item.id);
    setShowForm(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="chevron-double-left"
            size={35}
            color="#4A90E2"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        {canWrite && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setMessage("");
            }}
          >
            <MaterialCommunityIcons
              name={showForm ? "close" : "plus"}
              size={28}
              color="#FFF"
            />
          </TouchableOpacity>
        )}
      </View>

      {showForm && canWrite && (
        <View style={styles.formContainer}>
          <Text style={styles.label}>
            {editingId ? "Edit Announcement" : "New Announcement"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter announcement message..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.saveButton, submitting && { opacity: 0.6 }]}
            onPress={saveAnnouncement}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingId ? "Update" : "Save"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#6B8E4E" style={{ marginTop: 60 }} />
      ) : announcements.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bullhorn-outline" size={60} color="#999" />
          <Text style={styles.emptyText}>No announcements yet</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="bullhorn" size={22} color="#6B8E4E" />
                <Text style={styles.cardDate}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.cardMessage}>{item.message}</Text>
              {canWrite && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => editAnnouncement(item)}>
                    <MaterialCommunityIcons name="pencil" size={20} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAnnouncement(item.id)}>
                    <MaterialCommunityIcons name="delete" size={20} color="#E57373" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10, flex: 1 }],
  addButton: { backgroundColor: COLORS.primary, width: 45, height: 45, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  formContainer: { backgroundColor: COLORS.white, margin: 20, padding: 20, borderRadius: 20 },
  label: shared.labelLarge,
  input: { backgroundColor: COLORS.inputBg, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, fontFamily: "sans-serif", minHeight: 80, textAlignVertical: "top" },
  saveButton: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 25, alignItems: "center", marginTop: 15 },
  saveButtonText: { color: COLORS.white, fontSize: 18, fontFamily: "sans-serif", fontWeight: "bold" },
  emptyState: [shared.emptyState, { marginTop: 80 }],
  emptyText: [shared.emptyText, { marginTop: 10 }],
  listContainer: { padding: 20, paddingBottom: 30 },
  card: [shared.card, { marginBottom: 12 }],
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardDate: { fontSize: 14, color: COLORS.textMuted, fontFamily: "sans-serif" },
  cardMessage: { fontSize: 18, fontFamily: "sans-serif", lineHeight: 26, marginBottom: 12 },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 20 },
});
