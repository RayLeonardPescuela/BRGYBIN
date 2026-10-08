import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "../config/firebase";
import { useUser } from "../config/UserContext";
import { canWriteContent, canViewAdminPanel } from "../config/roles";
import shared, { COLORS } from "../styles";

export default function ManageRewards({ navigation }) {
  const { userData } = useUser();
  const canWrite = canWriteContent(userData); // Main Admin only (collectors = view only)
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    points: "",
    description: "",
    stock: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const snapshot = await db.collection("rewardItems").get();
      const itemList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemList);
    } catch (error) {
      console.log("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItem.name || !newItem.points) {
      Alert.alert("Error", "Please fill in name and points");
      return;
    }

    try {
      await db.collection("rewardItems").add({
        name: newItem.name,
        points: parseInt(newItem.points),
        description: newItem.description || "",
        stock: parseInt(newItem.stock) || 0,
        createdAt: new Date(),
      });
      setModalVisible(false);
      setNewItem({ name: "", points: "", description: "", stock: "" });
      fetchItems();
    } catch (error) {
      Alert.alert("Error", "Failed to add item");
    }
  };

  const deleteItem = async (itemId) => {
    Alert.alert("Delete Item", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await db.collection("rewardItems").doc(itemId).delete();
          fetchItems();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemIcon}>
        <MaterialCommunityIcons name="gift" size={30} color="#FFF" />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDesc}>{item.description || "No description"}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemPoints}>{item.points} pts</Text>
          <Text style={styles.itemStock}>Stock: {item.stock || 0}</Text>
        </View>
      </View>
      {canWrite && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteItem(item.id)}>
          <MaterialCommunityIcons name="delete" size={22} color="#E57373" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Rewards</Text>
        {canWrite && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.divider} />

      {/* QR Generator Button — staff only (collectors generate fixed 1/day QRs) */}
      {canViewAdminPanel(userData) && (
        <TouchableOpacity 
          style={styles.qrButton}
          onPress={() => navigation.navigate("QRGenerator")}
        >
          <MaterialCommunityIcons name="qrcode" size={30} color="#FFF" />
          <View style={styles.qrButtonText}>
            <Text style={styles.qrButtonTitle}>Generate QR Code</Text>
            <Text style={styles.qrButtonSub}>Create reward QR for users to scan</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Items List */}
      <Text style={styles.sectionTitle}>Redeemable Items</Text>
      
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="gift-outline" size={50} color="#999" />
          <Text style={styles.loadingText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add redeemable items</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Item Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Reward Item</Text>

            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Eco Bag"
              value={newItem.name}
              onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            />

            <Text style={styles.label}>Points Required *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 100"
              keyboardType="numeric"
              value={newItem.points}
              onChangeText={(text) => setNewItem({ ...newItem, points: text })}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional description"
              value={newItem.description}
              onChangeText={(text) => setNewItem({ ...newItem, description: text })}
            />

            <Text style={styles.label}>Stock Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 50"
              keyboardType="numeric"
              value={newItem.stock}
              onChangeText={(text) => setNewItem({ ...newItem, stock: text })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addItem}>
                <Text style={styles.saveBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  qrButton: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primaryDarker, marginHorizontal: 20, padding: 15, borderRadius: 15, marginBottom: 20, gap: 12 },
  qrButtonText: { flex: 1 },
  qrButtonTitle: { color: COLORS.white, fontSize: 18, fontWeight: "bold", fontFamily: "sans-serif" },
  qrButtonSub: { color: COLORS.background, fontSize: 13, fontFamily: "sans-serif" },
  sectionTitle: [shared.sectionTitle, { paddingHorizontal: 20 }],
  center: shared.center,
  loadingText: shared.loadingText,
  emptySubtext: shared.emptySubtext,
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  itemCard: shared.itemCard,
  itemIcon: shared.itemIcon,
  itemInfo: shared.itemInfo,
  itemName: shared.itemName,
  itemDesc: shared.itemDesc,
  itemMeta: shared.itemMeta,
  itemPoints: shared.itemPoints,
  itemStock: shared.itemStock,
  deleteBtn: { padding: 8 },
  modalOverlay: shared.modalOverlay,
  modalContent: shared.modalContent,
  modalTitle: [shared.modalTitle, { textAlign: "center" }],
  label: [shared.modalLabel, { marginTop: 10 }],
  input: shared.modalInput,
  modalActions: shared.modalActions,
  cancelBtn: shared.modalCancelBtn,
  cancelBtnText: shared.modalCancelText,
  saveBtn: shared.modalSaveBtn,
  saveBtnText: shared.modalSaveText,
});
