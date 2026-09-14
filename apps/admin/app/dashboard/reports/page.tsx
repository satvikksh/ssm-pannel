"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface RevenueDay {
  _id: string;
  revenue: number;
  cost: number;
}

interface StatusCount {
  _id: string;
  count: number;
}

const statusColor = (s: string) => {
  const lower = (s || "").toLowerCase();
  if (["completed"].includes(lower)) return "bg-green-100 text-green-700";
  if (["processing", "in_progress"].includes(lower)) return "bg-blue-100 text-blue-700";
  if (["pending"].includes(lower)) return "bg-yellow-100 text-yellow-700";
  if (["canceled", "cancelled", "refunded", "error", "failed"].includes(lower))
    return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
};

export default function ReportsPage() {
  const [revenue, setRevenue] = useState<RevenueDay[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [rev, status] = await Promise.all([
          apiGet<RevenueDay[] | { data?: RevenueDay[] }>(`/admin/revenue?days=${days}`),
          apiGet<StatusCount[] | { data?: StatusCount[] }>("/admin/orders-by-status"),
        ]);
        setRevenue(Array.isArray(rev) ? rev : (rev as { data?: RevenueDay[] }).data || []);
        setStatusCounts(Array.isArray(status) ? status : (status as { data?: StatusCount[] }).data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  const totalRevenue = revenue.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalCost = revenue.reduce((s, r) => s + (r.cost || 0), 0);
  const totalOrders = statusCounts.reduce((s, c) => s + (c.count || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading reports...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Total Revenue ({days}d)</p>
              <p className="text-2xl font-bold">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Total Cost ({days}d)</p>
              <p className="text-2xl font-bold">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Profit ({days}d)</p>
              <p className="text-2xl font-bold">
                ${(totalRevenue - totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Revenue by Day</h2>
              {revenue.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No revenue data for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.map((r) => (
                        <tr key={r._id} className="border-b border-gray-100">
                          <td className="px-3 py-2 font-medium">{r._id}</td>
                          <td className="px-3 py-2 text-right">
                            ${(r.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            ${(r.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            ${((r.revenue || 0) - (r.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Orders by Status</h2>
              <p className="text-sm text-gray-500 mb-3">
                Total orders: {totalOrders}
              </p>
              {statusCounts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No order data.</p>
              ) : (
                <div className="space-y-2">
                  {statusCounts
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <div key={s._id} className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColor(s._id)}`}>
                          {s._id}
                        </span>
                        <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{
                              width: `${totalOrders > 0 ? (s.count / totalOrders) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-12 text-right">
                          {s.count}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}