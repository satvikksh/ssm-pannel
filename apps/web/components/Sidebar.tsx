"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/orders", label: "My Orders" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/refills", label: "Refills" },
  { href: "/dashboard/drip-feed", label: "Drip Feed" },
  { href: "/dashboard/subscriptions", label: "Subscriptions" },
  { href: "/dashboard/referrals", label: "Referrals" },
  { href: "/dashboard/tickets", label: "Tickets" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/api-keys", label: "API Keys" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 p-4">
        <div className="text-lg font-bold text-blue-600">SMM Panel</div>
        {user ? (
          <div className="mt-2 text-sm">
            <div className="truncate font-medium text-gray-800">
              {user.name || user.username}
            </div>
            <div className="text-gray-500">
              Balance: ₹ {formatMoney(user.walletBalance)}
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {links.map((link) => {
          const active =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-1.5 text-sm ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-2">
        <button
          onClick={() => void logout()}
          className="w-full rounded-md px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}