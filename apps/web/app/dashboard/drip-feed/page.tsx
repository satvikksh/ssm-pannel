"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, asList } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

interface DripFeedOrder {
  id: string;
  publicDripId?: string;
  service?: { name?: string } | string;
  serviceName?: string;
  quantity?: number;
  runs?: number;
  interval?: number;
  intervalMinutes?: number;
  status?: string;
  createdAt?: string;
  created?: string;
}

function serviceNameOf(item: DripFeedOrder): string {
  if (typeof item.service === "string") return item.service;
  if (item.service && typeof item.service === "object") {
    return (item.service as { name?: string }).name ?? item.serviceName ?? "—";
  }
  return item.serviceName ?? "—";
}

export default function DripFeedPage() {
  const [items, setItems] = useState<DripFeedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/drip-feed/my");
      setItems(asList<DripFeedOrder>(data, "dripFeed", "dripFeeds"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drip feed orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(item: DripFeedOrder, action: "pause" | "resume") {
    setBusyId(item.id);
    setError("");
    try {
      await apiPatch(`/drip-feed/${item.id}/${action}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} drip feed.`);
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Spinner />;

  if (items.length === 0) {
    return (
      <div>
        <PageHeader
          title="Drip Feed"
          subtitle="Manage your drip feed (scheduled) orders."
        />
        <EmptyState text="No drip feed orders yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Drip Feed"
        subtitle="Manage your drip feed (scheduled) orders."
      />
      <ErrorBox message={error} />

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const status = (item.status || "").toLowerCase();
          const interval = item.interval ?? item.intervalMinutes;
          return (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {serviceNameOf(item)}
                  </div>
                  <div className="mt-1 font-mono text-xs text-gray-500">
                    {item.publicDripId || item.id}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-gray-500">Quantity</dt>
                  <dd className="font-medium">{item.quantity ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Runs</dt>
                  <dd className="font-medium">{item.runs ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Interval</dt>
                  <dd className="font-medium">
                    {interval != null
                      ? `${interval} min`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 text-xs text-gray-400">
                Created {formatDate(item.createdAt ?? item.created)}
              </div>
              <div className="mt-3 flex gap-2">
                {status !== "paused" ? (
                  <Button
                    variant="secondary"
                    disabled={busyId === item.id}
                    onClick={() => void handleAction(item, "pause")}
                  >
                    {busyId === item.id ? "Working..." : "Pause"}
                  </Button>
                ) : null}
                {status === "paused" ? (
                  <Button
                    variant="success"
                    disabled={busyId === item.id}
                    onClick={() => void handleAction(item, "resume")}
                  >
                    {busyId === item.id ? "Working..." : "Resume"}
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}