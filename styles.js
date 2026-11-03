import { StyleSheet } from "react-native";

/* ================= COLORS ================= */
export const COLORS = {
  background: "#C5D8A4",
  backgroundAlt: "#cfe1a8",
  primary: "#6B8E4E",
  primaryDark: "#3E5C3E",
  primaryDarker: "#3E5132",
  primaryLight: "#E8F5E9",
  secondary: "#7CB342",
  accent: "#4A90E2",
  white: "#FFFFFF",
  black: "#000000",
  error: "#E57373",
  success: "#4CAF50",
  warning: "#FFB74D",
  gold: "#FFD700",
  textPrimary: "#333333",
  textSecondary: "#666666",
  textMuted: "#999999",
  textDark: "#3E2723",
  textGreeting: "#555555",
  inputBorder: "#DDDDDD",
  inputBg: "#F5F5F5",
  cardBg: "#FFFFFF",
  cancelBg: "#EEEEEE",
  red: "#C62828",
  brown: "#8B4513",
  brownDark: "#556B2F",
  brownLight: "#888888",
  blue: "#E3F2FD",
  googleBlue: "#4285F4",
  grayLine: "#444444",
  overlay: "rgba(0,0,0,0.5)",
};

/* ================= FONT ================= */
const FONT = "sans-serif";

/* ================= COMMON STYLES ================= */
const shared = StyleSheet.create({
  /* ---------- Containers ---------- */
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  containerCentered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  /* ---------- Headers ---------- */
  // LOCKED page-title position: every back-chevron screen must land its
  // title on the same line (60px = 40 wrapper + the old 20, consolidated
  // here so screens can't drift apart again). Do not add per-screen
  // paddingTop on top of this — adjust here instead.
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
  },

  headerWithTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    fontFamily: FONT,
    color: COLORS.textDark,
  },

  headerTitleLarge: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: FONT,
    color: COLORS.textDark,
  },

  /* ---------- Back Button ---------- */
  backButton: {
    marginRight: 10,
  },

  /* ---------- Top Bar (Home/Admin) ---------- */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },

  greeting: {
    fontSize: 16,
    fontFamily: FONT,
    color: COLORS.textGreeting,
  },

  userName: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  /* ---------- Badges ---------- */
  adminBadge: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.white,
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },

  roleBadge: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.white,
    fontFamily: FONT,
  },

  /* ---------- Cards ---------- */
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    padding: 15,
    elevation: 2,
  },

  cardLarge: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    elevation: 2,
  },

  /* ---------- Stat Cards ---------- */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    elevation: 2,
  },

  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: FONT,
    marginTop: 5,
  },

  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: FONT,
    marginTop: 2,
  },

  /* ---------- Section Titles ---------- */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: FONT,
    marginBottom: 12,
  },

  /* ---------- Grid ---------- */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },

  gridItem: {
    width: "30%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "center",
    elevation: 2,
  },

  gridLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: FONT,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 14,
  },

  gridLabelLarge: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONT,
    textAlign: "center",
    marginTop: 8,
  },

  /* ---------- Activity Cards ---------- */
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    gap: 12,
  },

  activityInfo: {
    flex: 1,
  },

  activityTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: FONT,
  },

  activitySub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONT,
    marginTop: 2,
  },

  /* ---------- Inputs ---------- */
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 30,
    paddingHorizontal: 20,
    height: 60,
    elevation: 2,
  },

  inputWrapperSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },

  inputField: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT,
    color: COLORS.textDark,
  },

  inputIcon: {
    marginRight: 10,
  },

  /* ---------- Buttons ---------- */
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
    elevation: 4,
  },

  primaryButtonText: {
    fontSize: 20,
    color: COLORS.white,
    fontFamily: FONT,
    fontWeight: "bold",
  },

  secondaryButton: {
    backgroundColor: COLORS.cancelBg,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  /* ---------- Tabs ---------- */
  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 30,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 4,
  },

  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 6,
  },

  tabActive: {
    backgroundColor: COLORS.primary,
  },

  tabText: {
    fontSize: 16,
    fontFamily: FONT,
    color: COLORS.textPrimary,
  },

  tabTextActive: {
    color: COLORS.white,
    fontWeight: "bold",
  },

  /* ---------- Empty States ---------- */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: 18,
    fontFamily: FONT,
    color: COLORS.textMuted,
  },

  emptySubtext: {
    fontSize: 14,
    fontFamily: FONT,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  /* ---------- Loading ---------- */
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    fontSize: 16,
    fontFamily: FONT,
    color: COLORS.textSecondary,
  },

  /* ---------- Modals ---------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 25,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: FONT,
    marginBottom: 15,
  },

  modalLabel: {
    fontSize: 14,
    fontFamily: FONT,
    marginBottom: 6,
    color: COLORS.textPrimary,
  },

  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONT,
    marginBottom: 12,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    gap: 15,
  },

  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.cancelBg,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  modalCancelText: {
    fontWeight: "bold",
    fontFamily: FONT,
    fontSize: 16,
  },

  modalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  modalSaveText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontFamily: FONT,
    fontSize: 16,
  },

  /* ---------- Type Selector ---------- */
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },

  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },

  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  typeButtonText: {
    fontSize: 13,
    fontFamily: FONT,
    color: COLORS.textPrimary,
  },

  typeButtonTextActive: {
    color: COLORS.white,
    fontWeight: "bold",
  },

  /* ---------- Form Labels ---------- */
  label: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: FONT,
    marginBottom: 8,
    color: COLORS.textPrimary,
  },

  labelLarge: {
    fontSize: 18,
    fontFamily: FONT,
    marginBottom: 10,
    color: COLORS.textPrimary,
  },

  /* ---------- Error ---------- */
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 15,
    gap: 8,
  },

  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT,
    color: COLORS.red,
  },

  /* ---------- Scroll Content ---------- */
  scrollContent: {
    paddingBottom: 90,
    paddingHorizontal: 20,
  },

  scrollContentSmall: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },

  /* ---------- Announcement Banner ---------- */
  announcementBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryDark,
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    gap: 10,
  },

  announcementText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    fontFamily: FONT,
  },

  /* ---------- Item Card (Manage/Redeem) ---------- */
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },

  itemIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  itemDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONT,
    marginTop: 2,
  },

  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginTop: 4,
  },

  itemPoints: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
    fontFamily: FONT,
  },

  itemStock: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },

  /* ---------- Points Banner ---------- */
  pointsBanner: {
    backgroundColor: COLORS.primaryDarker,
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
  },

  pointsBannerText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  /* ---------- Summary Cards ---------- */
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 12,
  },

  summaryCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
  },

  summaryValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  summaryLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: FONT,
    opacity: 0.9,
    marginTop: 2,
  },

  /* ---------- History Card ---------- */
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },

  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  historyInfo: {
    flex: 1,
  },

  historyLabel: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: FONT,
  },

  historyDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 2,
  },

  historyPoints: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: FONT,
  },

  /* ---------- Buttons with opacity ---------- */
  disabledButton: {
    opacity: 0.6,
  },
});

export default shared;
