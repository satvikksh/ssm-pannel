"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";

interface AppNotification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  read?: boolean;
  isRead?: boolean;
  type?: string;
  link?: string;
  createdAt?: string;
  created?: string;
}

interface NotificationsResponse {
  items?: AppNotification[];
  notifications?: AppNotification[];
  unread?: number;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<NotificationsResponse | AppNotification[]>(
        "/notifications/my?page=1&pageSize=50",
      );
      const isArray = Array.isArray(data);
      const list = isArray
        ? (data as AppNotification[])
        : (data as NotificationsResponse).items ??
          (data as NotificationsResponse).notifications ??
          [];
      setItems(list);
      setUnread(
        !isArray && typeof (data as NotificationsResponse).unread === "number"
          ? ((data as NotificationsResponse).unread ?? 0)
          : list.filter((n) => !n.read && !n.isRead).length,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(item: AppNotification) {
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      await apiPatch(`/notifications/read/${item.id}`);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark notification as read.");
    } finally {
      setBusyId("");
    }
  }

  async function markAllRead() {
    setError("");
    setMessage("");
    try {
      await apiPost("/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      setMessage("All notifications marked as read.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark all as read.");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread notification(s)` : "You're all caught up."}
        />
        <Button
          variant="secondary"
          disabled={unread === 0}
          onClick={() => void markAllRead()}
        >
          Mark All Read
        </Button>
      </div>

      <ErrorBox message={error} />
      {message ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState text="No notifications yet." />
      ) : (
        <Card className="divide-y divide-gray-100 p-0">
          {items.map((item) => {
            const isRead = item.read ?? item.isRead ?? false;
            return (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-4 px-4 py-3 ${
                  isRead ? "" : "bg-blue-50/50"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isRead ? "text-gray-600" : "text-gray-900"
                      }`}
                    >
                      {item.title || "Notification"}
                    </span>
                    {!isRead ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    ) : null}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                    {item.body || item.message || "—"}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <StatusBadge status={item.type || "info"} />
                    <span>{formatDate(item.createdAt ?? item.created)}</span>
                  </div>
                </div>
                {!isRead ? (
                  <Button
                    variant="secondary"
                    disabled={busyId === item.id}
                    onClick={() => void markRead(item)}
                    className="shrink-0 !px-3 !py-1 text-xs"
                  >
                    {busyId === item.id ? "..." : "Mark read"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}