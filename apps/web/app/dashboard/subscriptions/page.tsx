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

interface Subscription {
  id: string;
  publicSubscriptionId?: string;
  service?: { name?: string } | string;
  serviceName?: string;
  status?: string;
  nextRun?: string;
  createdAt?: string;
  created?: string;
}

function serviceNameOf(item: Subscription): string {
  if (typeof item.service === "string") return item.service;
  if (item.service && typeof item.service === "object") {
    return (item.service as { name?: string }).name ?? item.serviceName ?? "—";
  }
  return item.serviceName ?? "—";
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/subscriptions/my");
      setSubscriptions(asList<Subscription>(data, "subscriptions"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load subscriptions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatus(
    item: Subscription,
    status: "active" | "paused" | "canceled",
  ) {
    setBusyId(item.id);
    setError("");
    try {
      await apiPatch(`/subscriptions/${item.id}/${status}`);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Failed to update subscription.`,
      );
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage recurring service subscriptions."
      />
      <ErrorBox message={error} />

      {subscriptions.length === 0 ? (
        <EmptyState text="No subscriptions yet." />
      ) : (
        <Table headers={["Subscription", "Service", "Status", "Next Run", "Actions"]}>
          {subscriptions.map((sub) => {
            const status = (sub.status || "").toLowerCase();
            return (
              <tr key={sub.id}>
                <Td className="font-mono text-xs">
                  {sub.publicSubscriptionId || sub.id}
                </Td>
                <Td>{serviceNameOf(sub)}</Td>
                <Td>
                  <StatusBadge status={sub.status} />
                </Td>
                <Td>{formatDate(sub.nextRun ?? sub.createdAt ?? sub.created)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {status !== "active" ? (
                      <Button
                        variant="success"
                        disabled={busyId === sub.id}
                        onClick={() => void handleStatus(sub, "active")}
                        className="!px-2 !py-1 text-xs"
                      >
                        {busyId === sub.id ? "Working..." : "Activate"}
                      </Button>
                    ) : null}
                    {status !== "paused" ? (
                      <Button
                        variant="secondary"
                        disabled={busyId === sub.id}
                        onClick={() => void handleStatus(sub, "paused")}
                        className="!px-2 !py-1 text-xs"
                      >
                        Pause
                      </Button>
                    ) : null}
                    {status !== "canceled" && status !== "cancelled" ? (
                      <Button
                        variant="danger"
                        disabled={busyId === sub.id}
                        onClick={() => void handleStatus(sub, "canceled")}
                        className="!px-2 !py-1 text-xs"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}