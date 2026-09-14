"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface Payment {
  id: string;
  userId?: string;
  user?: { username?: string; email?: string } | null;
  amount?: number;
  gateway?: string;
  status?: string;
  createdAt?: string;
}

interface PaymentsResponse {
  data?: Payment[];
  payments?: Payment[];
  items?: Payment[];
  total?: number;
}

const STATUS_OPTIONS = ["pending", "approved", "rejected", "completed", "failed"];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actioning, setActioning] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState<Payment | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "20" });
        if (status) params.set("status", status);
        const data = await apiGet<PaymentsResponse>(
          `/payments/admin/all?${params.toString()}`
        );
        setPayments(data.data || data.payments || data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load payments");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status]);

  const refresh = async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "20" });
    if (status) params.set("status", status);
    const data = await apiGet<PaymentsResponse>(`/payments/admin/all?${params.toString()}`);
    setPayments(data.data || data.payments || data.items || []);
  };

  const approve = async (id: string) => {
    setActioning(`approve:${id}`);
    setFeedback("");
    setError("");
    try {
      await apiPost(`/payments/admin/${id}/approve`);
      setFeedback("Payment approved");
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve payment");
    } finally {
      setActioning("");
    }
  };

  const reject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    setActioning(`reject:${rejecting.id}`);
    setFeedback("");
    setError("");
    try {
      await apiPost(`/payments/admin/${rejecting.id}/reject`, {
        reason: rejectReason,
      });
      setFeedback("Payment rejected");
      setRejecting(null);
      setRejectReason("");
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject payment");
    } finally {
      setActioning("");
    }
  };

  const getUserDisplay = (p: Payment) => {
    if (p.user && typeof p.user === "object") {
      return p.user.username || p.user.email || "—";
    }
    return p.userId || "—";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

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

      <div className="flex gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading payments...</div>}

      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                  <td className="px-4 py-3">{getUserDisplay(p)}</td>
                  <td className="px-4 py-3 font-medium">
                    ${Number(p.amount ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{p.gateway || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        (p.status || "").toLowerCase() === "approved"
                          ? "bg-green-100 text-green-700"
                          : (p.status || "").toLowerCase() === "rejected"
                          ? "bg-red-100 text-red-700"
                          : (p.status || "").toLowerCase() === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(p.status || "").toLowerCase() === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(p.id)}
                          disabled={actioning === `approve:${p.id}`}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {actioning === `approve:${p.id}` ? "Approving..." : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejecting(p)}
                          disabled={actioning === `reject:${p.id}`}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Reject payment {rejecting.id}
            </h3>
            <form onSubmit={reject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Reason for rejection"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setRejecting(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actioning === `reject:${rejecting.id}`}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {actioning === `reject:${rejecting.id}` ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}