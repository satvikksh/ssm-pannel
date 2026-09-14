"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AdminPermission } from "@/lib/permissions";

interface PaymentMethod {
  code: string;
  name: string;
  type: string;
  description?: string;
  enabled: boolean;
  sortOrder: number;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MethodForm {
  code: string;
  name: string;
  type: string;
  description: string;
  sortOrder: number;
  minAmount: string;
  maxAmount: string;
  instructions: string;
}

const EMPTY_FORM: MethodForm = {
  code: "",
  name: "",
  type: "manual",
  description: "",
  sortOrder: 0,
  minAmount: "",
  maxAmount: "",
  instructions: "",
};

const TYPES = [
  "upi",
  "razorpay",
  "stripe",
  "paypal",
  "payu",
  "phonepe",
  "netbanking",
  "card",
  "manual",
  "other",
];

export default function PaymentMethodsPage() {
  const { canAccess } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MethodForm>(EMPTY_FORM);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const permissionGranted = canAccess(AdminPermission.PAYMENTS_MANAGE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<PaymentMethod[]>("/payments/admin/methods");
      setMethods(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissionGranted) load();
  }, [load, permissionGranted]);

  if (!permissionGranted) return null;

  const openCreate = () => {
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setFeedback("");
    setFormOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditingCode(m.code);
    setForm({
      code: m.code,
      name: m.name,
      type: m.type,
      description: m.description ?? "",
      sortOrder: m.sortOrder ?? 0,
      minAmount: m.minAmount != null ? String(m.minAmount) : "",
      maxAmount: m.maxAmount != null ? String(m.maxAmount) : "",
      instructions: m.instructions ?? "",
    });
    setFeedback("");
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        description: form.description,
        sortOrder: Number(form.sortOrder) || 0,
        minAmount: form.minAmount !== "" ? Number(form.minAmount) : undefined,
        maxAmount: form.maxAmount !== "" ? Number(form.maxAmount) : undefined,
        instructions: form.instructions,
      };
      if (editingCode) {
        await apiPatch(`/payments/admin/methods/${editingCode}`, payload);
        setFeedback("Payment method updated");
      } else {
        await apiPost("/payments/admin/methods", { ...payload, code: form.code });
        setFeedback("Payment method created");
      }
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to save method");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (m: PaymentMethod) => {
    setSaving(true);
    setFeedback("");
    try {
      await apiPatch(`/payments/admin/methods/${m.code}`, { enabled: !m.enabled });
      await load();
      setFeedback(`${m.name} ${m.enabled ? "disabled" : "enabled"}`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to toggle method");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (m: PaymentMethod) => {
    setSaving(true);
    setFeedback("");
    try {
      await apiDelete(`/payments/admin/methods/${m.code}`);
      await load();
      setFeedback(`${m.name} deleted`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to delete method");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payment Methods</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Method
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Payment methods are fully dynamic. Users can only deposit using <b>enabled</b>
        methods. Gateway config/credentials live server-side and are never shown.
      </p>

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm ${
            (feedback.includes("disabled") ||
              feedback.includes("Failed") ||
              feedback.includes("deleted")) &&
            !feedback.includes("enabled")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded text-sm bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Loading payment methods...</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Min/Max</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.code} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{m.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    {m.instructions ? (
                      <div className="text-xs text-gray-400 max-w-xs truncate" title={m.instructions}>
                        {m.instructions}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{m.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        m.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {m.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.minAmount != null || m.maxAmount != null
                      ? `${m.minAmount ?? "—"} – ${m.maxAmount ?? "∞"}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{m.sortOrder ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => toggleEnabled(m)}
                        disabled={saving}
                        className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        {m.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => openEdit(m)}
                        className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => doDelete(m)}
                        disabled={saving}
                        className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No payment methods yet. Create one to let users deposit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-auto py-8">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg my-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingCode ? `Edit ${editingCode}` : "Create Payment Method"}
            </h3>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  disabled={!!editingCode}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="upi, razorpay, manual..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="UPI"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                  <input
                    type="number"
                    value={form.minAmount}
                    onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                  <input
                    type="number"
                    value={form.maxAmount}
                    onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Shown to users before they pay."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingCode ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}