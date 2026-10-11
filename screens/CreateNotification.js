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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canWriteContent } from "../config/roles";
import shared, { COLORS } from "../styles";

export default function CreateNotification({ navigation }) {
  const { userData } = useUser();
  const canWrite = canWriteContent(userData); // Main Admin only (collectors = view only)
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("collection");
  const [sitios, setSitios] = useState([]);
  const [selectedSitio, setSelectedSitio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const types = [
    { key: "collection", label: "Collection", icon: "truck-delivery" },
    { key: "cleaning", label: "Cleaning", icon: "broom" },
    { key: "alert", label: "Alert", icon: "alert-octagon" },
    { key: "reward", label: "Reward", icon: "medal" },
    { key: "general", label: "General", icon: "bell" },
  ];

  useEffect(() => {
    const fetchSitios = async () => {
      try {
        const doc = await db.collection("config").doc("sitios").get();
        if (doc.exists) {
          setSitios(doc.data().names || []);
        }
      } catch (error) {
        console.log("Error fetching sitios:", error);
      }
    };
    fetchSitios();
  }, []);

  const sendNotification = async () => {
    if (!canWrite) {
      Alert.alert("Not allowed", "Only the Main Admin can send notifications");
      return;
    }
    if (!title.trim() || !message.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      await db.collection("notifications").add({
        title: title.trim(),
        message: message.trim(),
        type,
        sitio: selectedSitio || "",
        sentBy: userData?.name || "Admin",
        createdAt: new Date().toISOString(),
        // Per-user read state: each reader appends their own uid.
        // Replaces the old shared `read` boolean, where one resident's
        // tap marked the notification read for the entire barangay.
        readBy: [],
      });

      Alert.alert("Success", "Notification sent!");
      setTitle("");
      setMessage("");
      navigation.goBack();
    } catch (error) {
      console.log("Error sending notification:", error);
      Alert.alert("Error", "Failed to send. Try again.");
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.headerTitle}>Send Notification</Text>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        {/* Type Selector */}
        <Text style={styles.label}>Notification Type</Text>
        <View style={styles.typeRow}>
          {types.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.typeButton,
                type === item.key && styles.typeActive,
              ]}
              onPress={() => setType(item.key)}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={22}
                color={type === item.key ? "#FFF" : "#333"}
              />
              <Text
                style={[
                  styles.typeText,
                  type === item.key && styles.typeActiveText,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Notification title..."
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />

        {/* Message */}
        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Write your message here..."
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Sitio Selector */}
        <Text style={styles.label}>Sitio</Text>
        <View style={styles.sitioSection}>
          <TouchableOpacity
            style={[styles.sitioChip, selectedSitio === "" && styles.sitioChipActive]}
            onPress={() => setSelectedSitio("")}
          >
            <Text style={[styles.sitioChipText, selectedSitio === "" && styles.sitioChipTextActive]}>
              All Sitios
            </Text>
          </TouchableOpacity>
          {sitios.map((name, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.sitioChip, selectedSitio === name && styles.sitioChipActive]}
              onPress={() => setSelectedSitio(name)}
            >
              <Text style={[styles.sitioChipText, selectedSitio === name && styles.sitioChipTextActive]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Send Button */}
        {canWrite ? (
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={sendNotification}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={22} color="#FFF" />
                <Text style={styles.submitText}>Send Notification</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "#EEEEEE",
              padding: 15,
              borderRadius: 30,
              marginTop: 10,
            }}
          >
            <MaterialCommunityIcons name="lock" size={18} color="#666" />
            <Text style={{ color: "#666", fontWeight: "600", fontFamily: "sans-serif" }}>
              Only the Main Admin can send notifications
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  formContainer: { padding: 20 },
  label: shared.labelLarge,
  typeRow: shared.typeRow,
  typeButton: [shared.typeButton, { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 6 }],
  typeActive: shared.typeButtonActive,
  typeText: shared.typeButtonText,
  typeActiveText: shared.typeButtonTextActive,
  input: [shared.inputWrapperSmall, { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 14, fontSize: 18, marginBottom: 20 }],
  messageInput: { height: 140 },
  submitButton: [shared.primaryButton, { flexDirection: "row", justifyContent: "center", paddingVertical: 16, borderRadius: 30, gap: 10, marginTop: 10 }],
  submitText: [shared.primaryButtonText, { fontSize: 20 }],

  // Sitio selector
  sitioSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  sitioChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  sitioChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sitioChipText: {
    fontSize: 14,
    fontFamily: "sans-serif",
    color: COLORS.textPrimary,
  },
  sitioChipTextActive: {
    color: COLORS.white,
    fontWeight: "bold",
  },
});
