import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
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

  // Each category: a short definition + example list, plus the bin
  // illustration shown above them in the card. Images live in
  // assets/waste/ (copied in as .jpg — Metro only bundles files
  // inside the project).
  const content = {
    Biodegradable: {
      image: require("../assets/waste/biodegradable.jpg"),
      description: "Waste that can decompose naturally through microorganisms.",
      examples: [
        "Fruit peels",
        "Vegetable scraps",
        "Leftover food",
        "Dried leaves",
        "Grass clippings",
        "Paper",
        "Eggshells",
      ],
    },
    Recyclable: {
      image: require("../assets/waste/recyclable.jpg"),
      description: "Materials that can be processed and made into new products.",
      examples: [
        "Plastic bottles",
        "Newspapers",
        "Cardboard boxes",
        "Aluminum cans",
        "Glass jars",
        "Metal scraps",
        "Used paper",
      ],
    },
    "Non-Biodegradable": {
      image: require("../assets/waste/non-biodegradable.jpg"),
      description:
        "Waste that does not decompose naturally or takes a very long time to break down.",
      examples: [
        "Plastic bottles",
        "Plastic bags",
        "Styrofoam",
        "Rubber tires",
        "Glass bottles",
        "Aluminum cans",
      ],
    },
    "E-Waste": {
      image: require("../assets/waste/e-waste.jpg"),
      description: "Discarded electrical and electronic devices or their parts.",
      examples: [
        "Old cellphones",
        "Broken computers",
        "Damaged televisions",
        "Batteries",
        "Old chargers",
        "Broken keyboards",
        "Headphones",
      ],
    },
    Hazardous: {
      image: require("../assets/waste/hazardous.jpg"),
      description:
        "Waste that can harm people, animals, or the environment because it contains dangerous substances.",
      examples: [
        "Pesticides",
        "Paint and paint thinner",
        "Used motor oil",
        "Chemical cleaners",
        "Fluorescent light bulbs",
        "Expired medicines",
        "Batteries",
      ],
    },
  };

  const selected = content[selectedType];

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

      {/* Content Area — image, definition and example list. The whole
          card scrolls: the bullet list makes it taller than the old
          single paragraph ever was. */}
      <ScrollView contentContainerStyle={styles.infoScroll}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{selectedType}</Text>

          <View style={styles.imageWrapper}>
            <Image source={selected.image} style={styles.image} resizeMode="contain" />
          </View>

          <Text style={styles.infoText}>{selected.description}</Text>

          <View style={styles.list}>
            {selected.examples.map((example) => (
              <View key={example} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listItemText}>{example}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

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
  infoScroll: { paddingHorizontal: 20, paddingBottom: 10 },
  infoCard: [shared.card, { padding: 25 }],
  infoTitle: { fontSize: 22, fontFamily: "sans-serif", fontWeight: "bold", color: COLORS.black, marginBottom: 15 },
  imageWrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 15,
  },
  image: { width: "100%", height: 200 },
  infoText: { fontSize: 18, fontFamily: "sans-serif", lineHeight: 28, color: COLORS.black, marginBottom: 15 },
  list: { marginTop: 5 },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  bullet: { fontSize: 18, lineHeight: 26, color: COLORS.secondary, marginRight: 10 },
  listItemText: { fontSize: 18, lineHeight: 26, color: COLORS.black, flex: 1 },
});
