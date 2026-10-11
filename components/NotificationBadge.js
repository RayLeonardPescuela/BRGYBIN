import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../styles";

/**
 * Unread count indicator — the little red dot on the notification bell.
 *
 * Renders nothing at zero, so the dashboard looks clean when everything
 * has been read. Caps at `max` and shows "9+" beyond it, which is both
 * what Messenger does and honest: past a handful the exact number stops
 * being useful, and it keeps the badge a fixed size so the grid does not
 * shift as the count changes.
 *
 * A white ring separates it from whatever is behind it — the grid icons
 * are white on a dark tile, where a bare red dot would disappear.
 */
export default function NotificationBadge({ count, max = 9 }) {
  if (!count || count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);

  return (
    <View style={styles.badge} accessibilityLabel={`${count} unread notifications`}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: COLORS.red,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    // Lift it above the icon on Android, which honours elevation.
    zIndex: 1,
  },
  text: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
    lineHeight: 13,
  },
});
