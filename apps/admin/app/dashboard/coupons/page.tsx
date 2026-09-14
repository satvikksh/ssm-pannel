"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

interface Coupon {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  value?: number;
  uses?: number;
  maxUses?: number;
  status?: string;
  createdAt?: string;
}

interface CouponsResponse {
  data?: Coupon[];
  coupons?: Coupon[];
  items?: Coupon[];
  total?: number;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: "",
    maxUses: "",
    status: "active",
  });
  const [actioning, setActioning] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiGet<CouponsResponse>("/coupons?page=1&pageSize=20");
        setCoupons(data.data || data.coupons || data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load coupons");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refresh = async () => {
    const data = await apiGet<CouponsResponse>("/coupons?page=1&pageSize=20");
    setCoupons(data.data || data.coupons || data.items || []);
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFeedback("");
    try {
      await apiPost("/coupons", {
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        status: form.status,
      });
      setShowCreate(false);
      setForm({ code: "", type: "percent", value: "", maxUses: "", status: "active" });
      setFeedback("Coupon created");
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create coupon");
    }
  };

  const toggleStatus = async (c: Coupon) => {
    setActioning(c.id);
    setError("");
    setFeedback("");
    try {
      const next = (c.status || "active").toLowerCase() === "active" ? "inactive" : "active";
      await apiPatch(`/coupons/${c.id}/status`, { status: next });
      setFeedback(`Coupon ${c.code || c.id} ${next}`);
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update coupon");
    } finally {
      setActioning("");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreate ? "Cancel" : "+ New Coupon"}
        </button>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded text-sm bg-green-50 text-green-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded text-sm bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={createCoupon} className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Create Coupon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              placeholder="Coupon code"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
              placeholder="Value"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="Max uses (optional)"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Coupon
          </button>
        </form>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Loading coupons...</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Max Uses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => {
                const isActive = (c.status || "active").toLowerCase() === "active";
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono font-medium">{c.code || c.name || c.id}</td>
                    <td className="px-4 py-3">{c.type || "—"}</td>
                    <td className="px-4 py-3">
                      {c.value != null
                        ? c.type === "percent"
                          ? `${c.value}%`
                          : `$${Number(c.value).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{c.uses ?? 0}</td>
                    <td className="px-4 py-3">{c.maxUses ?? "∞"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(c)}
                        disabled={actioning === c.id}
                        className={`px-3 py-1 text-xs rounded hover:opacity-80 disabled:opacity-50 ${
                          isActive
                            ? "bg-red-600 text-white"
                            : "bg-green-600 text-white"
                        }`}
                      >
                        {actioning === c.id
                          ? "..." 
                          : isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No coupons found
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