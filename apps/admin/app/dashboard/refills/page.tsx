"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Refill {
  _id: string;
  publicRefillId?: string;
  orderId?: string | { publicOrderId?: string };
  userId?: string | { username?: string; email?: string };
  status?: string;
  createdAt?: string;
}

interface RefillsData {
  items?: Refill[];
  refills?: Refill[];
}

const statusColor = (s: string) => {
  const lower = (s || "").toLowerCase();
  if (["completed", "success"].includes(lower)) return "bg-green-100 text-green-700";
  if (["processing", "in_progress"].includes(lower)) return "bg-blue-100 text-blue-700";
  if (["pending"].includes(lower)) return "bg-yellow-100 text-yellow-700";
  if (["failed", "canceled", "cancelled"].includes(lower)) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
};

export default function AdminRefillsPage() {
  const [refills, setRefills] = useState<Refill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<RefillsData>(`/refills/admin/all?page=1&pageSize=50`);
        setRefills(data.items || data.refills || (Array.isArray(data) ? (data as unknown as Refill[]) : []));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load refills");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const orderDisplay = (r: Refill) => {
    if (r.orderId && typeof r.orderId === "object") return r.orderId.publicOrderId || "—";
    return String(r.orderId || "—");
  };

  const userDisplay = (r: Refill) => {
    if (r.userId && typeof r.userId === "object") {
      return r.userId.username || r.userId.email || "—";
    }
    return String(r.userId || "—");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Refills</h1>

      {loading && <div className="text-center py-8 text-gray-500">Loading refills...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Refill ID</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {refills.map((r, i) => (
                <tr key={r._id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs">{r.publicRefillId || r._id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{orderDisplay(r)}</td>
                  <td className="px-4 py-3">{userDisplay(r)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(r.status || "")}`}>
                      {r.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {refills.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No refills found
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