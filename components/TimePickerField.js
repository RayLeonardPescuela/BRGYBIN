import React, { useState } from "react";
import { Platform, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../styles";

/* ============================================================
 * Time helpers
 *
 * Stored format is always "8:00 AM" (what the rest of the app
 * already renders). parseTimeToDate() is tolerant so schedules
 * written by the old free-text field still display correctly.
 * ============================================================ */

const withTime = (h, m) =>
  new Date(2000, 0, 1, Math.max(0, Math.min(23, h)), Math.max(0, Math.min(59, m)), 0, 0);

export function parseTimeToDate(value) {
  const fallback = new Date(2000, 0, 1, 8, 0, 0);
  if (!value) return fallback;

  const raw = String(value).trim();
  if (!raw) return fallback;

  // 12-hour: "8:00 AM" | "8AM" | "12:15pm"
  const ampm = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (/[Pp]/.test(ampm[3])) h += 12;
    return withTime(h, parseInt(ampm[2] || "0", 10));
  }

  // 24-hour: "14:30" | "08:00"
  const h24 = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (h24 && parseInt(h24[1], 10) <= 23) {
    return withTime(parseInt(h24[1], 10), parseInt(h24[2], 10));
  }

  // Hour only: "8"
  const hourOnly = raw.match(/^(\d{1,2})$/);
  if (hourOnly && parseInt(hourOnly[1], 10) <= 23) {
    return withTime(parseInt(hourOnly[1], 10), 0);
  }

  // Last resort: let Date parse it (covers odd legacy entries)
  const parsed = new Date(`2000-01-01 ${raw}`);
  if (!isNaN(parsed.getTime())) return withTime(parsed.getHours(), parsed.getMinutes());

  return fallback;
}

export function formatTime(date) {
  if (!date) return "";
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

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
