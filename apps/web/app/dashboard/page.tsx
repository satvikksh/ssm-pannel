"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, asList } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

interface Order {
  id: string;
  publicOrderId?: string;
  service?: { name?: string } | string;
  serviceName?: string;
  status?: string;
  quantity?: number;
  createdAt?: string;
  created?: string;
}

interface AppNotification {
  id: string;
  title?: string;
  message?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt?: string;
  created?: string;
}

const quickLinks = [
  { href: "/dashboard/services", label: "Services", desc: "Browse and order services" },
  { href: "/dashboard/wallet", label: "Wallet", desc: "View balance and transactions" },
  { href: "/dashboard/services", label: "Create Order", desc: "Place a new order" },
];

function serviceNameOf(order: Order): string {
  if (typeof order.service === "string") return order.service;
  if (order.service && typeof order.service === "object") {
    return (order.service as { name?: string }).name ?? order.serviceName ?? "—";
  }
  return order.serviceName ?? "—";
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [wallet, setWallet] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [walletData, ordersData, notifData] = await Promise.all([
          apiGet<unknown>("/wallet").catch(() => null),
          apiGet<unknown>("/orders/my?pageSize=5"),
          apiGet<unknown>("/notifications/my?pageSize=5"),
        ]);
        if (!mounted) return;
        const w = walletData as {
          balance?: number;
          wallet?: { balance?: number };
        };
        const balance = w?.balance ?? w?.wallet?.balance ?? null;
        setWallet(
          typeof balance === "number"
            ? balance
            : balance != null
              ? Number(balance)
              : null,
        );
        setOrders(asList<Order>(ordersData, "orders"));
        setNotifications(asList<AppNotification>(notifData, "notifications"));
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    void refreshUser();
    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  if (loading) return <Spinner />;

  const balance = wallet ?? user?.walletBalance ?? 0;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name || user?.username || "User"}`}
        subtitle="Here is your panel at a glance."
      />

      <ErrorBox message={error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-sm font-medium text-gray-500">Wallet Balance</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            ₹ {formatMoney(balance)}
          </div>
          <Link
            href="/dashboard/wallet/deposit"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Add Funds
          </Link>
        </Card>
        {quickLinks.map((link) => (
          <Card key={link.label}>
            <div className="text-sm font-medium text-gray-500">{link.label}</div>
            <p className="mt-1 text-sm text-gray-600">{link.desc}</p>
            <Link
              href={link.href}
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Go →
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
            <Link
              href="/dashboard/orders"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="p-4">
              <EmptyState text="No orders yet. Head to services to place one." />
            </div>
          ) : (
            <Table headers={["ID", "Service", "Status", "Qty", "Created"]}>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.publicOrderId || o.id}</Td>
                  <Td>{serviceNameOf(o)}</Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                  <Td>{o.quantity ?? "—"}</Td>
                  <Td>{formatDate(o.createdAt ?? o.created)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="text-base font-semibold text-gray-900">
              Recent Notifications
            </h2>
            <Link
              href="/dashboard/notifications"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState text="You're all caught up — no notifications." />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {n.title || "Notification"}
                    </div>
                    {n.message ? (
                      <div className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                        {n.message}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-gray-400">
                      {formatDate(n.createdAt ?? n.created)}
                    </div>
                  </div>
                  <StatusBadge
                    status={(n.read ?? n.isRead) ? "Read" : "Unread"}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}