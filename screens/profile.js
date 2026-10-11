import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Navbar from "../components/Navbar";
import { useUser } from "../config/UserContext";
import { db } from "../config/firebase";
import { signOutAndCleanup } from "../config/reminders";
import shared, { COLORS } from "../styles";

export default function Profile({ navigation }) {
  const { user, userData, refreshUserData } = useUser();
  const [profileImage, setProfileImage] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileSitio, setProfileSitio] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePoints, setProfilePoints] = useState(0);
  const [pendingImage, setPendingImage] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSitio, setEditSitio] = useState("");
  const [saving, setSaving] = useState(false);
  const [sitios, setSitios] = useState([]);
  const [sitioModalVisible, setSitioModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        if (user) {
          const doc = await db.collection("users").doc(user.uid).get();
          if (doc.exists) {
            const data = doc.data();
            setProfileImage(data.profileImage || null);
            setProfileName(data.name || "");
            setProfileSitio(data.sitio || "");
            setProfileEmail(data.email || "");
            setProfilePoints(data.points || 0);
          }
        }
      };
      loadProfile();

      const fetchSitios = async () => {
        try {
          const doc = await db.collection("config").doc("sitios").get();
          if (doc.exists) {
            setSitios(doc.data().names || []);
          }
        } catch (err) {
          console.log("Error fetching sitios:", err);
        }
      };
      fetchSitios();
    }, [user])
  );

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant gallery access to change profile photo");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPendingImage(result.assets[0].uri);
    }
  };

  const cancelPendingPhoto = () => {
    setPendingImage(null);
  };

  const saveProfilePhoto = async () => {
    if (!pendingImage || !user) return;

    setSavingPhoto(true);
    try {
      const response = await fetch(pendingImage);
      const blob = await response.blob();

      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await db.collection("users").doc(user.uid).update({
        profileImage: base64,
      });

      await refreshUserData();
      setProfileImage(base64);
      setPendingImage(null);
      Alert.alert("Success", "Profile photo updated!");
    } catch (error) {
      console.log("Error saving image:", error);
      Alert.alert("Error", "Failed to save profile image. Please try again.");
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutAndCleanup();
      navigation.reset({ index: 0, routes: [{ name: "Start" }] });
    } catch (e) {
      console.log("Sign out error:", e);
    }
  };

  const startEditing = () => {
    setEditName(profileName);
    setEditSitio(profileSitio);
    setEditModalVisible(true);
  };

  const cancelEditing = () => {
    setEditModalVisible(false);
    setEditName("");
    setEditSitio("");
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (!editSitio.trim()) {
      Alert.alert("Error", "Sitio cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await db.collection("users").doc(user.uid).update({
        name: editName.trim(),
        sitio: editSitio.trim(),
      });
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        setProfileName(data.name || "");
        setProfileSitio(data.sitio || "");
      }
      await refreshUserData();
      setEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.log("Error saving profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const displayImage = pendingImage || profileImage;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <TouchableOpacity onPress={startEditing} style={styles.editButton}>
          <Ionicons name="create-outline" size={28} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeaderContainer}>
        <View style={styles.iconWrapper}>
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={120} color="black" />
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={18} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.profileTitle}>Profile</Text>
        <Text style={styles.userName}>{profileName || "User"}</Text>

        {pendingImage && (
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.savePhotoBtn, savingPhoto && { opacity: 0.6 }]}
              onPress={saveProfilePhoto}
              disabled={savingPhoto}
            >
              {savingPhoto ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.savePhotoText}>Save Photo</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelPhotoBtn}
              onPress={cancelPendingPhoto}
              disabled={savingPhoto}
            >
              <Text style={styles.cancelPhotoText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Information Box */}
      <View style={styles.infoBox}>
        <View style={styles.inputField}>
          <Ionicons name="person-outline" size={20} color="black" style={styles.fieldIcon} />
          <Text style={styles.inputText} numberOfLines={1} ellipsizeMode="tail">{profileName || "User"}</Text>
        </View>

        <View style={styles.inputField}>
          <Ionicons name="mail-outline" size={20} color="black" style={styles.fieldIcon} />
          <Text style={styles.inputText} numberOfLines={1} ellipsizeMode="tail">{profileEmail || "email@example.com"}</Text>
        </View>

        <View style={styles.inputField}>
          <Ionicons name="star" size={20} color="black" style={styles.fieldIcon} />
          <Text style={styles.inputText} numberOfLines={1} ellipsizeMode="tail">{profilePoints} Points</Text>
        </View>

        <View style={styles.inputField}>
          <Ionicons name="location-outline" size={20} color="black" style={styles.fieldIcon} />
          <Text style={styles.inputText} numberOfLines={1} ellipsizeMode="tail">{profileSitio || "No sitio set"}</Text>
        </View>
      </View>

      {/* Log Out Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Navbar />

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={cancelEditing}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
            />

            <Text style={styles.modalLabel}>Sitio</Text>
            <TouchableOpacity
              style={styles.sitioPicker}
              onPress={() => setSitioModalVisible(true)}
            >
              <Text style={[styles.sitioPickerText, !editSitio && { color: "#999" }]}>
                {editSitio || "Select Sitio"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={cancelEditing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sitio Picker Modal */}
      <Modal visible={sitioModalVisible} animationType="slide" transparent>
        <View style={styles.sitioModalOverlay}>
          <View style={styles.sitioModalBackdrop} />
          <View style={styles.sitioModalContent}>
            <View style={styles.sitioModalHeader}>
              <Text style={styles.sitioModalTitle}>Select Sitio</Text>
              <TouchableOpacity onPress={() => setSitioModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={26} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {sitios.length === 0 ? (
              <View style={styles.sitioModalEmpty}>
                <MaterialCommunityIcons name="map-marker-off" size={40} color={COLORS.textMuted} />
                <Text style={styles.sitioModalEmptyText}>No sitios available</Text>
              </View>
            ) : (
              <FlatList
                data={sitios}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.sitioModalOption,
                      editSitio === item && styles.sitioModalOptionActive,
                    ]}
                    onPress={() => {
                      setEditSitio(item);
                      setSitioModalVisible(false);
                    }}
                  >
                    <View style={styles.radioCircle}>
                      {editSitio === item && <View style={styles.radioSelected} />}
                    </View>
                    <Text
                      style={[
                        styles.sitioModalOptionText,
                        editSitio === item && styles.sitioModalOptionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  editButton: { padding: 5 },
  profileHeaderContainer: { alignItems: "center", marginTop: 10 },
  iconWrapper: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  imageContainer: { position: "relative" },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.black },
  cameraIcon: { position: "absolute", bottom: 5, right: 5, backgroundColor: COLORS.primary, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.white },
  profileTitle: { fontSize: 32, fontFamily: "sans-serif", marginTop: -10 },
  userName: { fontSize: 28, fontFamily: "sans-serif", marginTop: 5 },
  photoActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  savePhotoBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  savePhotoText: { color: COLORS.white, fontSize: 16, fontFamily: "sans-serif", fontWeight: "bold" },
  cancelPhotoBtn: { backgroundColor: COLORS.cancelBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  cancelPhotoText: { fontSize: 16, fontFamily: "sans-serif", fontWeight: "600", color: COLORS.textPrimary },
  infoBox: { backgroundColor: COLORS.primary, marginHorizontal: 30, marginTop: 20, borderRadius: 25, padding: 20, alignItems: "center" },
  inputField: { backgroundColor: COLORS.white, width: "100%", height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", marginBottom: 15, paddingHorizontal: 20 },
  fieldIcon: { marginRight: 10 },
  inputText: { flex: 1, fontSize: 16, fontFamily: "sans-serif" },
  logoutButton: { backgroundColor: "#777F71", marginHorizontal: 80, marginTop: 30, marginBottom: 90, height: 55, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  logoutText: { color: COLORS.black, fontSize: 28, fontFamily: "sans-serif" },
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
  sitioPickerText: {
    fontSize: 15,
    fontFamily: "sans-serif",
    color: COLORS.textPrimary,
  },

  // Sitio picker modal
  sitioModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  sitioModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
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
  sitioModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    color: COLORS.textDark,
  },
  sitioModalEmpty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  sitioModalEmptyText: {
    fontSize: 14,
    fontFamily: "sans-serif",
    color: COLORS.textMuted,
    marginTop: 8,
  },
  sitioModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  sitioModalOptionActive: {
    backgroundColor: COLORS.primaryLight,
  },
  sitioModalOptionText: {
    fontSize: 16,
    fontFamily: "sans-serif",
    color: COLORS.textDark,
  },
  sitioModalOptionTextActive: {
    fontWeight: "bold",
    color: COLORS.primary,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
});
