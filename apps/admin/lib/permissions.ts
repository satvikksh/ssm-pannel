export const AdminPermission = {
  ADMIN_DASHBOARD: "admin.dashboard",
  ADMIN_FINANCE: "admin.finance",
  ADMIN_MANAGE: "admin.manage",
  USERS_VIEW: "users.view",
  USERS_EDIT: "users.edit",
  ORDERS_MANAGE: "orders.manage",
  SERVICES_MANAGE: "services.manage",
  PROVIDERS_MANAGE: "providers.manage",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_APPROVE: "payments.approve",
  PAYMENTS_MANAGE: "payments.manage",
  COUPONS_MANAGE: "coupons.manage",
  TICKETS_VIEW: "tickets.view",
  TICKETS_MANAGE: "tickets.manage",
  SETTINGS_MANAGE: "settings.manage",
  LICENSE_MANAGE: "license.manage",
} as const;

export type AdminPermissionValue = (typeof AdminPermission)[keyof typeof AdminPermission];

export const PERMISSION_GROUPS: { label: string; value: AdminPermissionValue }[] = [
  { label: "Dashboard & Finance", value: AdminPermission.ADMIN_DASHBOARD },
  { label: "Finance (approve payments)", value: AdminPermission.ADMIN_FINANCE },
  { label: "Manage Admins (Super Admin)", value: AdminPermission.ADMIN_MANAGE },
  { label: "View Users", value: AdminPermission.USERS_VIEW },
  { label: "Edit Users", value: AdminPermission.USERS_EDIT },
  { label: "Manage Orders", value: AdminPermission.ORDERS_MANAGE },
  { label: "Manage Services", value: AdminPermission.SERVICES_MANAGE },
  { label: "Manage Providers", value: AdminPermission.PROVIDERS_MANAGE },
  { label: "View Payments", value: AdminPermission.PAYMENTS_VIEW },
  { label: "Approve/Reject Payments", value: AdminPermission.PAYMENTS_APPROVE },
  { label: "Manage Coupons", value: AdminPermission.COUPONS_MANAGE },
  { label: "View Tickets", value: AdminPermission.TICKETS_VIEW },
  { label: "Manage Tickets", value: AdminPermission.TICKETS_MANAGE },
  { label: "Manage Settings", value: AdminPermission.SETTINGS_MANAGE },
  { label: "Manage License (Super Admin)", value: AdminPermission.LICENSE_MANAGE },
];

export interface NavEntry {
  href: string;
  label: string;
  icon: string;
  permission?: AdminPermissionValue;
  superAdminOnly?: boolean;
}

export const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", permission: AdminPermission.ADMIN_DASHBOARD },
  { href: "/dashboard/admins", label: "Admins", icon: "🛡️", superAdminOnly: true, permission: AdminPermission.ADMIN_MANAGE },
  { href: "/dashboard/users", label: "Users", icon: "👥", permission: AdminPermission.USERS_VIEW },
  { href: "/dashboard/services", label: "Services", icon: "⚙️", permission: AdminPermission.SERVICES_MANAGE },
  { href: "/dashboard/categories", label: "Categories", icon: "📁", permission: AdminPermission.SERVICES_MANAGE },
  { href: "/dashboard/providers", label: "Providers", icon: "🔗", permission: AdminPermission.PROVIDERS_MANAGE },
  { href: "/dashboard/orders", label: "Orders", icon: "📋", permission: AdminPermission.ORDERS_MANAGE },
  { href: "/dashboard/payments", label: "Payments", icon: "💰", permission: AdminPermission.PAYMENTS_VIEW },
  { href: "/dashboard/payment-methods", label: "Payment Methods", icon: "💳", permission: AdminPermission.PAYMENTS_MANAGE },
  { href: "/dashboard/refills", label: "Refills", icon: "🔄", permission: AdminPermission.ORDERS_MANAGE },
  { href: "/dashboard/drip-feeds", label: "Drip Feeds", icon: "⏱️", permission: AdminPermission.ORDERS_MANAGE },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "🔁", permission: AdminPermission.ORDERS_MANAGE },
  { href: "/dashboard/tickets", label: "Tickets", icon: "🎫", permission: AdminPermission.TICKETS_VIEW },
  { href: "/dashboard/coupons", label: "Coupons", icon: "🏷️", permission: AdminPermission.COUPONS_MANAGE },
  { href: "/dashboard/referrals", label: "Referrals", icon: "👥", permission: AdminPermission.USERS_VIEW },
  { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
  { href: "/dashboard/reports", label: "Reports", icon: "📈", permission: AdminPermission.ADMIN_DASHBOARD },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️", permission: AdminPermission.SETTINGS_MANAGE },
  { href: "/dashboard/license", label: "License", icon: "🔑", permission: AdminPermission.LICENSE_MANAGE },
  { href: "/dashboard/audit", label: "Audit", icon: "📝", permission: AdminPermission.ADMIN_DASHBOARD },
];

export function hasPermission(
  role: string,
  permissions: string[],
  permission?: AdminPermissionValue,
): boolean {
  if (role === "super_admin") return true;
  if (!permission) return true;
  return permissions.includes(permission);
}