"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface DashboardStats {
  metrics?: {
    totalUsers?: number;
    activeUsers?: number;
    totalOrders?: number;
    todayOrders?: number;
    todayRevenue?: number;
    pendingRefills?: number;
    totalServices?: number;
    pendingBalance?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<DashboardStats>("/admin/dashboard");
        setStats(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  const m = stats?.metrics ?? {};
  const statCards = [
    { label: "Total Users", value: m.totalUsers ?? 0, color: "bg-blue-500" },
    { label: "Active Users", value: m.activeUsers ?? 0, color: "bg-indigo-500" },
    { label: "Total Orders", value: m.totalOrders ?? 0, color: "bg-green-500" },
    { label: "Today's Orders", value: m.todayOrders ?? 0, color: "bg-teal-500" },
    { label: "Revenue (Today)", value: `$${(m.todayRevenue ?? 0).toLocaleString()}`, color: "bg-purple-500" },
    { label: "Pending Refills", value: m.pendingRefills ?? 0, color: "bg-amber-500" },
    { label: "Active Services", value: m.totalServices ?? 0, color: "bg-pink-500" },
    { label: "Pending Balance", value: `$${(m.pendingBalance ?? 0).toLocaleString()}`, color: "bg-slate-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-5">
            <p className="text-sm text-gray-500 mb-1">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Raw Stats</h2>
          <pre className="text-sm text-gray-600 bg-gray-50 p-4 rounded overflow-auto">
            {JSON.stringify(stats, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
