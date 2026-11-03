import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Navbar from "../components/Navbar";
import shared, { COLORS } from "../styles";

export default function SegregationGuide({ navigation }) {
  const [selectedType, setSelectedType] = useState("Biodegradable");

  // Data for the different waste types
  const wasteTypes = [
    { id: "1", name: "Biodegradable", icon: "leaf" },
    { id: "2", name: "Recyclable", icon: "recycle" },
    { id: "3", name: "Non-Biodegradable", icon: "bottle-wine-outline" },
    { id: "4", name: "E-Waste", icon: "cellphone-cog" },
    { id: "5", name: "Hazardous", icon: "skull-crossbones" },
  ];

  const content = {
    Biodegradable: "Biodegradable waste includes any organic matter in waste which can be broken down into carbon dioxide, water, methane or simple organic molecules by micro-organisms and other living things by composting, aerobic digestion, anaerobic digestion or similar processes.",
    Recyclable: "Recyclable materials include many kinds of glass, paper, cardboard, metal, plastic, tires, textiles, batteries, and electronics.",
    "Non-Biodegradable": "Non-biodegradable waste is a type of waste that cannot be broken down by biological processes. Examples include plastics, glass, and metals.",
    "E-Waste": "Electronic waste or e-waste describes discarded electrical or electronic devices. Used electronics which are destined for refurbishment, reuse, resale, or salvage recycling.",
    Hazardous: "Hazardous waste is waste that has substantial or potential threats to public health or the environment. It is often ignitable, reactive, or toxic.",
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-double-left" size={35} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Segregation Guide</Text>
      </View>

      {/* Horizontal Scrollable Circle Buttons */}
      <View style={styles.scrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {wasteTypes.map((item) => (
            <View key={item.id} style={styles.itemWrapper}>
              <TouchableOpacity
                style={[
                  styles.circleButton,
                  selectedType === item.name && styles.activeCircle,
                ]}
                onPress={() => setSelectedType(item.name)}
              >
                <MaterialCommunityIcons 
                  name={item.icon} 
                  size={50} 
                  color={selectedType === item.name ? "#FFF" : "#7CB342"} 
                />
              </TouchableOpacity>
              <Text style={styles.circleLabel}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>{content[selectedType]}</Text>
      </View>

      <Navbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: shared.container,
  header: shared.header,
  headerTitle: [shared.headerTitle, { marginLeft: 10 }],
  scrollWrapper: { height: 160 },
  scrollContent: { paddingHorizontal: 15, alignItems: "center" },
  itemWrapper: { alignItems: "center", marginHorizontal: 10 },
  circleButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" },
  activeCircle: { backgroundColor: COLORS.secondary, borderWidth: 2, borderColor: COLORS.white },
  circleLabel: { marginTop: 8, fontSize: 14, fontFamily: "sans-serif", textAlign: "center" },
  infoCard: [shared.card, { margin: 20, padding: 25, minHeight: 250 }],
  infoText: { fontSize: 18, fontFamily: "sans-serif", lineHeight: 28, textAlign: "justify" },
});