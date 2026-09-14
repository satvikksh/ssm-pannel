"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface DripFeed {
  _id: string;
  publicDripId?: string;
  userId?: string | { username?: string; email?: string };
  serviceId?: string | { name?: string };
  status?: string;
  completedRuns?: number;
  remainingRuns?: number;
  runs?: number;
  intervalMinutes?: number;
  link?: string;
  createdAt?: string;
}

const statusColor = (s: string) => {
  const lower = (s || "").toLowerCase();
  if (["completed"].includes(lower)) return "bg-green-100 text-green-700";
  if (["active"].includes(lower)) return "bg-blue-100 text-blue-700";
  if (["pending", "queued"].includes(lower)) return "bg-yellow-100 text-yellow-700";
  if (["paused"].includes(lower)) return "bg-amber-100 text-amber-700";
  if (["canceled", "cancelled", "failed"].includes(lower)) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
};

export default function AdminDripFeedsPage() {
  const [feeds, setFeeds] = useState<DripFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<DripFeed[] | { data?: DripFeed[] }>("/drip-feed/admin/all");
        setFeeds(Array.isArray(data) ? data : (data as { data?: DripFeed[] }).data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load drip feeds");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const serviceName = (f: DripFeed) => {
    if (f.serviceId && typeof f.serviceId === "object") return f.serviceId.name || "—";
    return "—";
  };

  const userDisplay = (f: DripFeed) => {
    if (f.userId && typeof f.userId === "object") return f.userId.username || f.userId.email || "—";
    return "—";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Drip Feeds</h1>

      {loading && <div className="text-center py-8 text-gray-500">Loading drip feeds...</div>}
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((f, i) => (
                <tr key={f._id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs">{f.publicDripId || f._id}</td>
                  <td className="px-4 py-3">{serviceName(f)}</td>
                  <td className="px-4 py-3">{userDisplay(f)}</td>
                  <td className="px-4 py-3">{f.completedRuns ?? 0} / {f.runs ?? "?"}</td>
                  <td className="px-4 py-3">{f.intervalMinutes ? `${f.intervalMinutes}m` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(f.status || "")}`}>
                      {f.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {f.createdAt ? new Date(f.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {feeds.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No drip feeds found
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