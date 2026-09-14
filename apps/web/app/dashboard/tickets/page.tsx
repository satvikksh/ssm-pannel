"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

interface Ticket {
  id: string;
  publicTicketId?: string;
  subject?: string;
  status?: string;
  createdAt?: string;
  created?: string;
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/tickets/my?page=1&pageSize=20");
      setTickets(asList<Ticket>(data, "tickets"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await apiPost("/tickets", {
        subject,
        message,
        priority,
      });
      setSuccess("Ticket created successfully.");
      setSubject("");
      setMessage("");
      setPriority("medium");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle="Contact support and track your requests."
      />

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tickets.length === 0 ? (
            <EmptyState text="No support tickets yet." />
          ) : (
            <Table headers={["Ticket", "Subject", "Status", "Created"]}>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                >
                  <Td className="font-mono text-xs">
                    {ticket.publicTicketId || ticket.id}
                  </Td>
                  <Td className="font-medium text-gray-900">
                    {ticket.subject || "—"}
                  </Td>
                  <Td>
                    <StatusBadge status={ticket.status} />
                  </Td>
                  <Td>{formatDate(ticket.createdAt ?? ticket.created)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            New Ticket
          </h2>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <Field label="Subject">
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="What do you need help with?"
              />
            </Field>
            <Field label="Message">
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Describe your issue..."
              />
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Create Ticket"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}