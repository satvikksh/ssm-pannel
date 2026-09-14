"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

interface Notification {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  read?: boolean;
  type?: string;
  createdAt?: string;
}

interface NotificationsResponse {
  data?: Notification[];
  notifications?: Notification[];
  items?: Notification[];
  total?: number;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actioning, setActioning] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiGet<NotificationsResponse>("/notifications/my?page=1&pageSize=50");
        setNotifications(data.data || data.notifications || data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isRead = (n: Notification) =>
    n.isRead === true || n.isRead === false ? n.isRead : Boolean(n.read);

  const markRead = async (id: string) => {
    setActioning(id);
    setFeedback("");
    setError("");
    try {
      await apiPatch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, read: true } : n)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    } finally {
      setActioning("");
    }
  };

  const markAllRead = async () => {
    setActioning("all");
    setFeedback("");
    setError("");
    try {
      for (const n of notifications) {
        if (!isRead(n)) {
          await apiPatch(`/notifications/${n.id}/read`).catch(() => {});
        }
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
      setFeedback("All notifications marked as read");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    } finally {
      setActioning("");
    }
  };

  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          onClick={markAllRead}
          disabled={actioning === "all" || unreadCount === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {actioning === "all" ? "Marking..." : "Mark All Read"}
        </button>
      </div>

      {unreadCount > 0 && (
        <div className="mb-4 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded">
          {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
        </div>
      )}

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

      {loading && <div className="text-center py-8 text-gray-500">Loading notifications...</div>}

      {!loading && !error && (
        <div className="space-y-3">
          {notifications.map((n) => {
            const read = isRead(n);
            return (
              <div
                key={n.id}
                className={`bg-white rounded-lg shadow p-4 flex items-start gap-3 ${
                  read ? "opacity-70" : "border-l-4 border-blue-500"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {n.title && <p className="font-medium">{n.title}</p>}
                    {!read && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  {n.message && <p className="text-sm text-gray-600 mt-1">{n.message}</p>}
                  <p className="text-xs text-gray-400 mt-2">
                    {n.type ? `${n.type} · ` : ""}
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                  </p>
                </div>
                {!read && (
                  <button
                    onClick={() => markRead(n.id)}
                    disabled={actioning === n.id}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
                  >
                    {actioning === n.id ? "..." : "Mark Read"}
                  </button>
                )}
              </div>
            );
          })}
          {notifications.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
              No notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}