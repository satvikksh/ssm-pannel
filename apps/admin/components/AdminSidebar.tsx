"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NAV_ENTRIES } from "@/lib/permissions";

const roleBadgeColor: Record<string, string> = {
  super_admin: "bg-red-600 text-white",
  admin: "bg-blue-600 text-white",
  finance_manager: "bg-green-600 text-white",
  support_agent: "bg-yellow-500 text-black",
  service_manager: "bg-purple-600 text-white",
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout, canAccess } = useAuth();

  const visibleLinks = (user
    ? NAV_ENTRIES.filter((entry) =>
        entry.superAdminOnly
          ? user.role === "super_admin"
          : canAccess(entry.permission),
      )
    : []) satisfies typeof NAV_ENTRIES;

  return (
    <aside className="w-64 min-h-screen bg-slate-800 text-white flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold">SMM Admin</h1>
        {user && (
          <div className="mt-2">
            <p className="text-sm text-slate-300 truncate">{user.name || user.email}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                roleBadgeColor[user.role] || "bg-slate-600 text-white"
              }`}
            >
              {user.role.replace("_", " ")}
            </span>
          </div>
        )}
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleLinks.map((link) => {
          const isActive =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-slate-600 text-white border-r-4 border-blue-400"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 rounded transition-colors"
        >
          <span className="text-base">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
