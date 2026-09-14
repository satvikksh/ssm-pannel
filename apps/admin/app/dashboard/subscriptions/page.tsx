"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Subscription {
  _id: string;
  publicSubscriptionId?: string;
  userId?: string | { username?: string; email?: string };
  serviceId?: string | { name?: string };
  status?: string;
  completedRuns?: number;
  runs?: number;
  nextRunAt?: string;
  intervalDays?: number;
  quantity?: number;
  link?: string;
  createdAt?: string;
}

const statusColor = (s: string) => {
  const lower = (s || "").toLowerCase();
  if (["completed", "active"].includes(lower)) return "bg-green-100 text-green-700";
  if (["pending"].includes(lower)) return "bg-yellow-100 text-yellow-700";
  if (["paused"].includes(lower)) return "bg-amber-100 text-amber-700";
  if (["canceled", "cancelled", "failed"].includes(lower)) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
};

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<Subscription[] | { data?: Subscription[] }>("/subscriptions/admin/all");
        setSubs(Array.isArray(data) ? data : (data as { data?: Subscription[] }).data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load subscriptions");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const serviceName = (s: Subscription) => {
    if (s.serviceId && typeof s.serviceId === "object") return s.serviceId.name || "—";
    return "—";
  };

  const userDisplay = (s: Subscription) => {
    if (s.userId && typeof s.userId === "object") return s.userId.username || s.userId.email || "—";
    return "—";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>

      {loading && <div className="text-center py-8 text-gray-500">Loading subscriptions...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">Interval</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => (
                <tr key={s._id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs">{s.publicSubscriptionId || s._id}</td>
                  <td className="px-4 py-3">{serviceName(s)}</td>
                  <td className="px-4 py-3">{userDisplay(s)}</td>
                  <td className="px-4 py-3">{s.completedRuns ?? 0} / {s.runs ?? "?"}</td>
                  <td className="px-4 py-3">{s.intervalDays ? `${s.intervalDays}d` : "—"}</td>
                  <td className="px-4 py-3">
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(s.status || "")}`}>
                      {s.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No subscriptions found
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