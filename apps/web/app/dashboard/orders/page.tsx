"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, asList } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Button,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";

interface Order {
  id: string;
  publicOrderId?: string;
  service?: { name?: string } | string;
  serviceName?: string;
  link?: string;
  quantity?: number;
  status?: string;
  createdAt?: string;
  created?: string;
}

const CANCELLABLE = new Set([
  "pending",
  "processing",
  "in progress",
  "in_progress",
  "queued",
  "partial",
]);

function serviceNameOf(order: Order): string {
  if (typeof order.service === "string") return order.service;
  if (order.service && typeof order.service === "object") {
    return (order.service as { name?: string }).name ?? order.serviceName ?? "—";
  }
  return order.serviceName ?? "—";
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cancellingId, setCancellingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/orders/my?page=1&pageSize=20");
      setOrders(asList<Order>(data, "orders"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancel(order: Order) {
    setCancellingId(order.id);
    setMessage("");
    try {
      await apiPost(`/orders/${order.id}/cancel`);
      setMessage(
        `Order ${order.publicOrderId || order.id} cancelled successfully.`,
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to cancel order.",
      );
    } finally {
      setCancellingId("");
    }
  }

  const statuses = [
    "All",
    ...Array.from(
      new Set(orders.map((o) => o.status || "unknown").filter(Boolean)),
    ),
  ];
  const filtered =
    statusFilter === "All"
      ? orders
      : orders.filter((o) => (o.status || "unknown") === statusFilter);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My Orders"
        subtitle="Track and manage your service orders."
      />

      <ErrorBox message={error} />
      {message ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              statusFilter === status
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="No orders to display." />
      ) : (
        <Table
          headers={["Order ID", "Service", "Link", "Qty", "Status", "Created", "Actions"]}
        >
          {filtered.map((order) => (
            <tr
              key={order.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => router.push(`/dashboard/orders/${order.id}`)}
            >
              <Td className="font-mono text-xs">
                {order.publicOrderId || order.id}
              </Td>
              <Td>{serviceNameOf(order)}</Td>
              <Td className="max-w-[200px] truncate">{order.link || "—"}</Td>
              <Td>{order.quantity ?? "—"}</Td>
              <Td>
                <StatusBadge status={order.status} />
              </Td>
              <Td>{formatDate(order.createdAt ?? order.created)}</Td>
              <Td>
                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                  {CANCELLABLE.has((order.status || "").toLowerCase()) ? (
                    <Button
                      variant="danger"
                      disabled={cancellingId === order.id}
                      onClick={() => void handleCancel(order)}
                      className="!px-2 !py-0.5 text-xs"
                    >
                      {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}