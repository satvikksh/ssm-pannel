"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface Provider {
  id: string;
  name: string;
  type?: string;
  status?: string;
  balance?: number | string;
  baseUrl?: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actioning, setActioning] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    name: "",
    type: "manual",
    apiKey: "",
    baseUrl: "",
    status: "active",
  });
  const [balanceResult, setBalanceResult] = useState<Record<string, unknown>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<Provider[] | { data?: Provider[]; providers?: Provider[] }>(
        "/providers"
      );
      const list = Array.isArray(data) ? data : data.data || data.providers || [];
      setProviders(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (id: string, action: "sync" | "balance" | "test") => {
    setActioning(`${id}:${action}`);
    setFeedback("");
    setError("");
    try {
      const res = await apiPost<Record<string, unknown>>(`/providers/${id}/${action}`);
      if (action === "balance") {
        setBalanceResult((prev) => ({ ...prev, [id]: res }));
        setFeedback(`${action} result stored for provider`);
      } else {
        setFeedback(`${action} completed successfully`);
      }
    } catch (err: unknown) {
      setFeedback("");
      setError(err instanceof Error ? err.message : `Failed to run ${action}`);
    } finally {
      setActioning("");
    }
  };

  const createProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFeedback("");
    try {
      await apiPost("/providers", form);
      setShowCreate(false);
      setForm({ name: "", type: "manual", apiKey: "", baseUrl: "", status: "active" });
      setFeedback("Provider created successfully");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create provider");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Providers</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreate ? "Cancel" : "+ New Provider"}
        </button>
      </div>

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

      {showCreate && (
        <form onSubmit={createProvider} className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Create Provider</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Provider name"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="Type (manual, smmpanel, ...)"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="API key"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="Base URL"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Provider
          </button>
        </form>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Loading providers...</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, i) => {
                const busy = actioning.startsWith(`${p.id}:`);
                const bal = balanceResult[p.id] as { balance?: number | string } | undefined;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.type || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          String(p.status ?? "active").toLowerCase() === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status ?? "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{bal?.balance ?? p.balance ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => runAction(p.id, "sync")}
                          disabled={busy}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {actioning === `${p.id}:sync` ? "Syncing..." : "Sync"}
                        </button>
                        <button
                          onClick={() => runAction(p.id, "balance")}
                          disabled={busy}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {actioning === `${p.id}:balance` ? "Checking..." : "Balance"}
                        </button>
                        <button
                          onClick={() => runAction(p.id, "test")}
                          disabled={busy}
                          className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        >
                          {actioning === `${p.id}:test` ? "Testing..." : "Test"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No providers found
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