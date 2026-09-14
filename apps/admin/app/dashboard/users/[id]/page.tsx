"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  status: string;
  referralCode: string;
  balance?: number;
  createdAt: string;
}

const STATUS_OPTIONS = ["active", "suspended", "banned"];
const TXN_TYPES = ["deposit", "order_payment", "refund", "adjustment", "commission"];

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [newStatus, setNewStatus] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [amount, setAmount] = useState("");
  const [txnType, setTxnType] = useState("adjustment");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<User>(`/users/${userId}`);
        setUser(data);
        setNewStatus(data.status);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const changeStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting("status");
    setFeedback("");
    try {
      await apiPatch(`/users/${userId}/status`, { status: newStatus });
      setUser((u) => (u ? { ...u, status: newStatus } : u));
      setFeedback(`Status updated to ${newStatus}`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSubmitting("");
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting("password");
    setFeedback("");
    try {
      await apiPatch(`/users/${userId}/reset-password`, { password: newPassword });
      setNewPassword("");
      setFeedback("Password reset successfully");
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting("");
    }
  };

  const adjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting("balance");
    setFeedback("");
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt)) throw new Error("Invalid amount");
      const updated = await apiPost<{ user?: User; balance?: number }>(
        `/admin/users/${userId}/balance`,
        { amount: amt, type: txnType, reason }
      );
      setAmount("");
      setReason("");
      setFeedback("Balance adjusted successfully");
      setUser((u) => ({
        ...u!,
        balance: updated.balance ?? (updated.user?.balance ?? u?.balance ?? 0),
      }));
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to adjust balance");
    } finally {
      setSubmitting("");
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading user...</div>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        User — {user.username || user.email}
      </h1>

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm ${
            feedback.includes("successfully") || feedback.includes("updated")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold mb-4">User Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">ID</p>
              <p className="font-mono text-xs">{user.id}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p>{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Username</p>
              <p>{user.username}</p>
            </div>
            <div>
              <p className="text-gray-500">Name</p>
              <p>{user.name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Role</p>
              <p>{user.role}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  user.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {user.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500">Balance</p>
              <p className="font-semibold">${Number(user.balance ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Referral Code</p>
              <p>{user.referralCode || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Created</p>
              <p>{new Date(user.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={changeStatus} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">Change Status</h3>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting === "status"}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting === "status" ? "Saving..." : "Update Status"}
            </button>
          </form>

          <form onSubmit={resetPassword} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">Reset Password</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="New password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={submitting === "password"}
              className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              {submitting === "password" ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <form onSubmit={adjustBalance} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">Adjust Balance</h3>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Amount (negative to deduct)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={txnType}
              onChange={(e) => setTxnType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TXN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={submitting === "balance"}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {submitting === "balance" ? "Adjusting..." : "Adjust Balance"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}