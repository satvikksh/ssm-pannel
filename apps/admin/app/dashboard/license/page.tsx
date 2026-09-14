"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface LicenseRecord {
  id: string;
  licenseKey: string;
  maskedKey?: string;
  adminUserId?: string;
  adminEmail?: string;
  status: string;
  type: string;
  expiresAt?: string | null;
  activatedAt?: string | null;
  installation?: { installationId: string; domain: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LicenseStatusInfo {
  activated?: boolean;
  licenseKey?: string;
  domain?: string;
  status?: string;
  expiresAt?: string;
  valid?: boolean;
  [key: string]: unknown;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-orange-100 text-orange-700",
  revoked: "bg-red-100 text-red-700",
  expired: "bg-gray-200 text-gray-600",
};

export default function LicensePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [status, setStatus] = useState<LicenseStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [licenseKey, setLicenseKey] = useState("");
  const [domain, setDomain] = useState("");
  const [activating, setActivating] = useState(false);

  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [admins, setAdmins] = useState<{ id: string; email: string; name?: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    adminId: "",
    type: "yearly",
    durationDays: 365,
  });
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiGet<LicenseStatusInfo>("/license/status");
      setStatus(data);
      if (!licenseKey) setLicenseKey((data.licenseKey as string) || "");
      if (!domain)
        setDomain((data.domain as string) || (typeof window !== "undefined" ? window.location.host : ""));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load license status");
    }
  }, [licenseKey, domain]);

  const loadRecords = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await apiGet<LicenseRecord[]>("/admin/licenses");
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setRecords([]);
    }
    try {
      const adminsData = await apiGet<{ items?: { id: string; email: string; name?: string }[] }>(
        "/admin/admins?page=1&pageSize=100",
      );
      setAdmins((adminsData.items ?? []).map((a) => ({ id: a.id, email: a.email, name: a.name })));
    } catch {
      setAdmins([]);
    }
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadStatus(), loadRecords()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load license data");
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadRecords]);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivating(true);
    setError("");
    setFeedback("");
    try {
      await apiPost("/license/activate", { licenseKey, domain });
      setFeedback("License activated successfully");
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate license");
    } finally {
      setActivating(false);
    }
  };

  const createLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const admin = admins.find((a) => a.id === createForm.adminId);
      if (!admin) throw new Error("Select an admin");
      await apiPost("/admin/licenses", {
        adminUserId: createForm.adminId,
        email: admin.email,
        name: admin.name,
        type: createForm.type,
        durationDays: Number(createForm.durationDays) || undefined,
      });
      setCreateOpen(false);
      setFeedback(`License created & assigned to ${admin.email} (pending approval)`);
      await loadRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create license");
    } finally {
      setSaving(false);
    }
  };

  const licenseAction = async (id: string, action: string, durationDays?: number) => {
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      if (action === "renew") {
        await apiPost(`/admin/licenses/${id}/renew`, { durationDays });
      } else {
        await apiPost(`/admin/licenses/${id}/${action}`, {});
      }
      setFeedback(`License ${action} successful`);
      await loadRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} license`);
    } finally {
      setSaving(false);
    }
  };

  const isActive = status?.activated === true || status?.valid === true;

  const grantButtons: Record<string, { action: string; label: string; style: string }[]> = {
    pending: [
      { action: "approve", label: "Approve", style: "bg-green-100 text-green-700 hover:bg-green-200" },
    ],
    approved: [
      { action: "suspend", label: "Suspend", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
      { action: "revoke", label: "Revoke", style: "bg-red-100 text-red-700 hover:bg-red-200" },
    ],
    active: [
      { action: "suspend", label: "Suspend", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
      { action: "revoke", label: "Revoke", style: "bg-red-100 text-red-700 hover:bg-red-200" },
    ],
    suspended: [
      { action: "renew", label: "Renew + Approve", style: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
      { action: "revoke", label: "Revoke", style: "bg-red-100 text-red-700 hover:bg-red-200" },
    ],
    expired: [
      { action: "renew", label: "Renew", style: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">License</h1>
        {isSuperAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create License
          </button>
        )}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">This Installation</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : status ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isActive ? "Active" : "Not Activated"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">License Key</dt>
                <dd className="font-mono text-xs">{status.licenseKey || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Domain</dt>
                <dd>{status.domain || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Expires</dt>
                <dd>
                  {status.expiresAt
                    ? new Date(String(status.expiresAt)).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">No license data</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Activate License</h2>
          <form onSubmit={activate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                License Key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example.com"
              />
            </div>
            <button
              type="submit"
              disabled={activating}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {activating ? "Activating..." : "Activate License"}
            </button>
          </form>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <h2 className="text-lg font-semibold px-6 pt-6 pb-2">All Admin Licenses</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.adminEmail ?? "—"}</div>
                    <div className="text-xs text-gray-500">{r.type}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.maskedKey ?? r.licenseKey ?? "—"}
                  </td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {(grantButtons[r.status] ?? []).map((b) => (
                        <button
                          key={b.action}
                          disabled={saving}
                          onClick={() =>
                            b.action === "renew"
                              ? licenseAction(r.id, "renew", 365)
                              : licenseAction(r.id, b.action)
                          }
                          className={`px-2.5 py-1 text-xs rounded hover:bg-opacity-80 disabled:opacity-50 ${b.style}`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No licenses created yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create & Assign License</h3>
            <p className="text-sm text-gray-500 mb-4">
              One license per Admin. The license is created as <b>pending</b> and must be
              approved before the Admin can use the panel.
            </p>
            <form onSubmit={createLicense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin</label>
                <select
                  value={createForm.adminId}
                  onChange={(e) => setCreateForm({ ...createForm, adminId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select admin…</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    value={createForm.durationDays}
                    onChange={(e) => setCreateForm({ ...createForm, durationDays: Number(e.target.value) })}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {error && (
                <div className="px-3 py-2 rounded text-sm bg-red-50 text-red-700">{error}</div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create License"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}