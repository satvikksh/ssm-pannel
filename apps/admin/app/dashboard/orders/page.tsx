"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Order {
  id: string;
  publicOrderId?: string;
  userId?: string;
  user?: { username?: string; email?: string } | null;
  serviceId?: string;
  service?: { name?: string } | string | null;
  quantity?: number;
  status?: string;
  createdAt?: string;
}

interface OrdersResponse {
  data?: Order[];
  orders?: Order[];
  items?: Order[];
  total?: number;
}

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "canceled",
  "cancelled",
  "refunded",
  "error",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "20" });
        if (status) params.set("status", status);
        if (userId) params.set("userId", userId);
        const data = await apiGet<OrdersResponse>(
          `/orders/admin/all?${params.toString()}`
        );
        setOrders(data.data || data.orders || data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(load, userId ? 300 : 0);
    return () => clearTimeout(timer);
  }, [status, userId]);

  const getUserDisplay = (o: Order) => {
    if (o.user && typeof o.user === "object") {
      return o.user.username || o.user.email || "—";
    }
    if (typeof o.user === "string") return o.user;
    return o.userId || "—";
  };

  const getServiceName = (o: Order) => {
    if (typeof o.service === "object" && o.service) return o.service.name || "—";
    return String(o.service || o.serviceId || "—");
  };

  const statusColor = (s: string) => {
    const lower = (s || "").toLowerCase();
    if (["completed"].includes(lower)) return "bg-green-100 text-green-700";
    if (["processing", "in_progress"].includes(lower)) return "bg-blue-100 text-blue-700";
    if (["pending"].includes(lower)) return "bg-yellow-100 text-yellow-700";
    if (["canceled", "cancelled", "refunded", "error"].includes(lower))
      return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orders</h1>
      <div className="flex gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Filter by user ID"
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading orders...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr
                  key={o.id}
                  className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{o.publicOrderId || o.id}</td>
                  <td className="px-4 py-3">{getUserDisplay(o)}</td>
                  <td className="px-4 py-3">{getServiceName(o)}</td>
                  <td className="px-4 py-3">{o.quantity ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(o.status || "")}`}>
                      {o.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}