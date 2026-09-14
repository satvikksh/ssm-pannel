"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";

interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  status: string;
  balance?: number;
  createdAt: string;
}

interface UsersResponse {
  data?: User[];
  users?: User[];
  items?: User[];
  total?: number;
}

interface AdjustModal {
  user: User;
  amount: string;
  type: string;
  reason: string;
}

const TXN_TYPES = ["deposit", "order_payment", "refund", "adjustment", "commission"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [modal, setModal] = useState<AdjustModal | null>(null);
  const [feedback, setFeedback] = useState("");
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "20" });
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        const data = await apiGet<UsersResponse>(`/users?${params.toString()}`);
        const list = data.data || data.users || data.items || [];
        setUsers(list);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, status]);

  const openAdjust = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    setModal({ user, amount: "", type: "adjustment", reason: "" });
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    setAdjusting(true);
    setFeedback("");
    try {
      const amount = parseFloat(modal.amount);
      if (isNaN(amount)) throw new Error("Invalid amount");
      await apiPost(`/admin/users/${modal.user.id}/balance`, {
        amount,
        type: modal.type,
        reason: modal.reason,
      });
      setFeedback("Balance adjusted successfully");
      setModal(null);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to adjust balance");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, username..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading users...</div>}

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
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/dashboard/users/${user.id}`)}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${
                    i % 2 === 1 ? "bg-gray-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{user.id}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">${Number(user.balance ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => openAdjust(e, user)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-1">
              Adjust Balance — {modal.user.username || modal.user.email}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Current balance: ${Number(modal.user.balance ?? 0).toFixed(2)}
            </p>
            {feedback && (
              <div
                className={`mb-4 px-3 py-2 rounded text-sm ${
                  feedback.includes("successfully")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {feedback}
              </div>
            )}
            <form onSubmit={submitAdjust} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (negative to deduct)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={modal.amount}
                  onChange={(e) => setModal({ ...modal, amount: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={modal.type}
                  onChange={(e) => setModal({ ...modal, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TXN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={modal.reason}
                  onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for adjustment"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {adjusting ? "Applying..." : "Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}