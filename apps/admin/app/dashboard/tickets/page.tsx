"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface Ticket {
  id: string;
  userId?: string;
  user?: { username?: string; email?: string } | null;
  subject?: string;
  status?: string;
  message?: string;
  messages?: Array<{
    id?: string;
    message?: string;
    isInternal?: boolean;
    userId?: string;
    createdAt?: string;
  }>;
  createdAt?: string;
}

interface TicketsResponse {
  data?: Ticket[];
  tickets?: Ticket[];
  items?: Ticket[];
  total?: number;
}

const STATUS_OPTIONS = ["open", "pending", "answered", "closed", "resolved"];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "20" });
        if (status) params.set("status", status);
        const data = await apiGet<TicketsResponse>(`/tickets/admin/all?${params.toString()}`);
        setTickets(data.data || data.tickets || data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load tickets");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSending(true);
    setFeedback("");
    try {
      await apiPost(`/tickets/admin/${selected.id}/reply`, {
        message: reply,
        isInternal,
      });
      setFeedback("Reply sent");
      setReply("");
      setIsInternal(false);
      const updated = await apiGet<Ticket>(`/tickets/admin/all?page=1&pageSize=20`);
      const list = Array.isArray(updated)
        ? updated
        : (updated as TicketsResponse).data ||
          (updated as TicketsResponse).tickets ||
          (updated as TicketsResponse).items ||
          [];
      const found = list.find((t) => t.id === selected.id);
      if (found) setSelected(found);
      setTickets(list);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const getUserDisplay = (t: Ticket) => {
    if (t.user && typeof t.user === "object") {
      return t.user.username || t.user.email || "—";
    }
    return t.userId || "—";
  };

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-blue-600 hover:underline"
        >
          ← Back to tickets
        </button>
        <h1 className="text-2xl font-bold mb-2">{selected.subject || "Ticket"}</h1>
        <p className="text-sm text-gray-500 mb-4">
          #{selected.id} · {getUserDisplay(selected)} ·{" "}
          {selected.createdAt
            ? new Date(selected.createdAt).toLocaleString()
            : "—"}{" "}
          ·{" "}
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
            {selected.status || "—"}
          </span>
        </p>

        {feedback && (
          <div
            className={`mb-4 px-4 py-3 rounded text-sm ${
              feedback === "Reply sent"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {feedback}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          {selected.message && (
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm">{selected.message}</p>
            </div>
          )}
          {(selected.messages || []).map((m, i) => (
            <div
              key={m.id || i}
              className={`p-4 rounded ${
                m.isInternal ? "bg-purple-50 border border-purple-200" : "bg-gray-50"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">
                {m.isInternal ? "Internal note" : "Message"}{" "}
                {m.createdAt ? `· ${new Date(m.createdAt).toLocaleString()}` : ""}
              </p>
              <p className="text-sm">{m.message}</p>
            </div>
          ))}
        </div>

        <form onSubmit={sendReply} className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-3">Reply</h3>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Write a reply..."
          />
          <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded"
            />
            Internal note (not visible to user)
          </label>
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tickets</h1>
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
        <span className="text-sm text-gray-500 self-center">Click a ticket to view & reply</span>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading tickets...</div>}

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
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${
                    i % 2 === 1 ? "bg-gray-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{t.id}</td>
                  <td className="px-4 py-3">{getUserDisplay(t)}</td>
                  <td className="px-4 py-3 font-medium">{t.subject || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        (t.status || "").toLowerCase() === "closed" ||
                        (t.status || "").toLowerCase() === "resolved"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {t.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No tickets found
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