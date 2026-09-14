"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, asList } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";

interface OrderDetail {
  id: string;
  publicOrderId?: string;
  service?: { name?: string } | string;
  serviceName?: string;
  link?: string;
  quantity?: number;
  status?: string;
  startCount?: number;
  currentCount?: number;
  remains?: number;
  createdAt?: string;
  created?: string;
  history?: unknown[] | null;
  statusHistory?: unknown[] | null;
  [key: string]: unknown;
}

function serviceNameOf(order: OrderDetail): string {
  if (typeof order.service === "string") return order.service;
  if (order.service && typeof order.service === "object") {
    return (order.service as { name?: string }).name ?? order.serviceName ?? "—";
  }
  return order.serviceName ?? "—";
}

function rowsOf(order: OrderDetail): Array<Record<string, unknown>> {
  return asList<Record<string, unknown>>(
    order.history ?? order.statusHistory,
    "history",
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!orderId) return;
    (async () => {
      try {
        const data = await apiGet<OrderDetail>(`/orders/my/${orderId}`);
        if (!mounted) return;
        setOrder(data);
        setHistory(rowsOf(data));
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load order.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) return <Spinner />;

  if (!order) {
    return (
      <div>
        <ErrorBox message={error} />
        <EmptyState text="Order not found." />
      </div>
    );
  }

  const detailRows: Array<[string, ReactNode]> = [
    ["Order ID", <span key="id" className="font-mono">{order.publicOrderId || order.id}</span>],
    ["Service", serviceNameOf(order)],
    ["Link", order.link || "—"],
    ["Quantity", String(order.quantity ?? "—")],
    ["Status", <StatusBadge key="st" status={order.status} />],
    ["Start Count", String(order.startCount ?? "—")],
    ["Current Count", String(order.currentCount ?? "—")],
    ["Remains", String(order.remains ?? "—")],
    ["Created", formatDate(order.createdAt ?? order.created)],
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Order Details" />
      <Link
        href="/dashboard/orders"
        className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        ← Back to Orders
      </Link>

      <ErrorBox message={error} />

      <Card>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {detailRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-right font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {history.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Status History
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(history[0]).map((key) => (
                    <th
                      key={key}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {history.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key} className="px-4 py-2 align-top">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}