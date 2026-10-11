import React, { useState } from "react";
import { Platform, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../styles";
// Date/time parsing lives in config/reminders.js so the scheduler and
// this picker can never disagree about what a stored time means.
import { parseTimeToDate, formatTime } from "../config/reminders";

// Re-exported for any caller that expects them from here.
export { parseTimeToDate, formatTime };

/* ============================================================
 * TimePickerField
 *
 * Replaces the free-text "Enter time" TextInput so a stored time
 * is always a valid "8:00 AM" string.
 *
 *   Android -> tapping opens the native clock dialog
 *   iOS     -> tapping toggles an inline spinner + Done
 *
 * Props: value, onChange(timeString), placeholder, style
 * ============================================================ */
export default function TimePickerField({
  value,
  onChange,
  placeholder = "Select time",
  style,
}) {
  const [show, setShow] = useState(false);

  const toggle = () => {
    // Android's picker is a dialog, so it is show/hide.
    // iOS renders inline, so it toggles.
    setShow((s) => !s);
  };

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") {
      setShow(false);
      // User backed out of the dialog without choosing a time
      if (event?.type === "dismissed") return;
    }
    if (selected) onChange(formatTime(selected));
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.field, style]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {show && (
        <View style={styles.pickerBox}>
          <DateTimePicker
            value={parseTimeToDate(value)}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShow(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontFamily: "sans-serif",
    color: COLORS.textDark,
  },
  placeholder: {
    color: COLORS.textMuted,
  },
  pickerBox: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginTop: 6,
    alignItems: "center",
    elevation: 3,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 30,
    marginBottom: 10,
  },
  doneText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontFamily: "sans-serif",
    fontSize: 15,
  },
});
