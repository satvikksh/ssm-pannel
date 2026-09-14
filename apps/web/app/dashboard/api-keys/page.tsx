"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
  SuccessBox,
  Table,
  Td,
} from "@/components/ui";

interface ApiKey {
  _id: string;
  keyId: string;
  name: string;
  enabled: boolean;
  permissions?: string[];
  ipRestrictions?: string[];
  lastUsedAt?: string;
  createdAt?: string;
}

interface CreateKeyResponse {
  keyId: string;
  secret?: string;
  note?: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreateKeyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<unknown>("/api-keys");
      setKeys(Array.isArray(data) ? (data as ApiKey[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreated(null);
    setSubmitting(true);
    try {
      const data = await apiPost<CreateKeyResponse>("/api-keys", {
        name: name.trim(),
      });
      setCreated(data);
      setSuccess("API key created. Copy the secret now — it is shown only once.");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(key: ApiKey) {
    setBusyId(key.keyId);
    setError("");
    setSuccess("");
    try {
      await apiPost(`/api-keys/${key.keyId}/revoke`);
      setSuccess(`API key "${key.name}" revoked.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke API key.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="API Keys"
        subtitle="Manage access to the SMM API for your account."
      />

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {keys.length === 0 ? (
            <EmptyState text="No API keys yet. Create one to access the API." />
          ) : (
            <Table headers={["Name", "Key ID", "Status", "Last Used", "Created", "Actions"]}>
              {keys.map((key) => (
                <tr key={key._id}>
                  <Td className="font-medium text-gray-900">{key.name}</Td>
                  <Td className="font-mono text-xs">{key.keyId}</Td>
                  <Td>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        key.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {key.enabled ? "Active" : "Revoked"}
                    </span>
                  </Td>
                  <Td>{formatDate(key.lastUsedAt)}</Td>
                  <Td>{formatDate(key.createdAt)}</Td>
                  <Td>
                    {key.enabled ? (
                      <Button
                        variant="danger"
                        disabled={busyId === key.keyId}
                        onClick={() => void revoke(key)}
                        className="!px-2 !py-1 text-xs"
                      >
                        {busyId === key.keyId ? "..." : "Revoke"}
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Create API Key
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Name" hint="A label to identify this key.">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="My integration"
              />
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Key"}
            </Button>
          </form>

          {created?.secret ? (
            <div className="mt-4 rounded-md bg-gray-900 p-4">
              <div className="break-all font-mono text-xs text-green-400">
                {created.secret}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {created.note ||
                  "Store this secret securely — it will not be shown again."}
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}