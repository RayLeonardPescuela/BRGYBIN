// ============================================================
// Single source of truth for app roles and permissions.
// A role is just a string stored on users.role in Firestore.
// Existing docs keep working: role "admin" = Main Admin.
// ============================================================

export const ROLES = ["admin", "collector", "user"];

export const ROLE_LABELS = {
  admin: "MAIN ADMIN",
  collector: "COLLECTOR",
  user: "USER",
};

export const ROLE_DESCRIPTIONS = {
  admin: "Full control — create, edit and delete everything",
  collector: "Can add schedules, resolve complaints and complete requests. Cannot delete.",
  user: "Resident — no admin access",
};

export const ROLE_COLORS = {
  admin: "#C62828", // red
  collector: "#4A90E2", // blue
  user: "#999999", // grey
};

const role = (u) => u?.role;

// ---------- Access ----------
// Admin + collector both land on AdminHome and see every tile.
export const canViewAdminPanel = (u) =>
  role(u) === "admin" || role(u) === "collector";

// ---------- Main Admin only (full CRUD) ----------
export const canManageUsers = (u) => role(u) === "admin";
export const canEditSchedule = (u) => role(u) === "admin";
export const canDelete = (u) => role(u) === "admin";
// rewards / announcements / notifications are view-only for collectors (for now)
export const canWriteContent = (u) => role(u) === "admin";

// ---------- Admin + Collector ----------
export const canAddSchedule = (u) => canViewAdminPanel(u);
export const canResolveComplaint = (u) => canViewAdminPanel(u);
export const canCompleteRequest = (u) => canViewAdminPanel(u);

// ---------- Display helpers ----------
export const roleLabel = (u) =>
  ROLE_LABELS[role(u)] || (role(u) ? String(role(u)).toUpperCase() : "USER");

export const roleColor = (u) => ROLE_COLORS[role(u)] || ROLE_COLORS.user;
