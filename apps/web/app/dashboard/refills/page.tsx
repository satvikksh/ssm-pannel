"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, asList } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
  SuccessBox,
  Table,
  Td,
} from "@/components/ui";

interface Refill {
  id: string;
  publicRefillId?: string;
  orderId?: string;
  order?: { id?: string; publicOrderId?: string };
  status?: string;
  createdAt?: string;
  created?: string;
}

function orderIdOf(refill: Refill): string {
  return (
    refill.order?.publicOrderId ||
    refill.order?.id ||
    refill.orderId ||
    "—"
  );
}

export default function RefillsPage() {
  const [refills, setRefills] = useState<Refill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/refills/my?page=1&pageSize=20");
      setRefills(asList<Refill>(data, "refills"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load refills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRequestRefill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const data = (await apiPost<{ message?: string }>("/refills", {
        orderId,
      })) as unknown as { message?: string };
      setSuccess(data?.message || "Refill requested successfully.");
      setOrderId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request refill.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Refills"
        subtitle="Request a refill for a completed or partial order."
      />

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {refills.length === 0 ? (
            <EmptyState text="No refills requested yet." />
          ) : (
            <Table
              headers={["Refill ID", "Order", "Status", "Created"]}
            >
              {refills.map((refill) => (
                <tr key={refill.id}>
                  <Td className="font-mono text-xs">
                    {refill.publicRefillId || refill.id}
                  </Td>
                  <Td className="font-mono text-xs">{orderIdOf(refill)}</Td>
                  <Td>
                    <StatusBadge status={refill.status} />
                  </Td>
                  <Td>{formatDate(refill.createdAt ?? refill.created)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Request a Refill
          </h2>
          <form onSubmit={handleRequestRefill} className="space-y-4">
            <Field label="Order ID">
              <input
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Enter your order public ID"
              />
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Request Refill"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}