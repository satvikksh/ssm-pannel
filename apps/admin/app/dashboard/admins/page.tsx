"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AdminPermission, PERMISSION_GROUPS, AdminPermissionValue } from "@/lib/permissions";

interface AdminRecord {
  _id: string;
  id?: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  status: string;
  permissions: string[];
  createdAt?: string;
}

interface AdminsResponse {
  items: AdminRecord[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

interface AdminForm {
  email: string;
  password: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
}

const ROLES = ["admin"];

const EMPTY_FORM: AdminForm = {
  email: "",
  password: "",
  name: "",
  role: "admin",
  status: "active",
  permissions: [],
};

export default function AdminsPage() {
  const { user, canAccess } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdminForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [resetTarget, setResetTarget] = useState<AdminRecord | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const permissionGranted = canAccess(AdminPermission.ADMIN_MANAGE);
  const isSuperAdmin = user?.role === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const data = await apiGet<AdminsResponse>(`/admin/admins?${params.toString()}`);
      setAdmins((data.items ?? []).map((a) => ({ ...a, id: a._id ?? a.id })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    if (permissionGranted) load();
  }, [load, permissionGranted]);

  if (!permissionGranted) return null;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback("");
    setFormOpen(true);
  };

  const openEdit = (a: AdminRecord) => {
    setEditingId(a.id ?? a._id);
    setForm({
      email: a.email,
      password: "",
      name: a.name ?? "",
      role: a.role,
      status: a.status,
      permissions: a.permissions ?? [],
    });
    setFeedback("");
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const role = form.role;
      const common = {
        name: form.name,
        role,
        status: form.status,
        permissions: form.permissions,
      };
      if (editingId) {
        await apiPatch(`/admin/admins/${editingId}`, common);
      } else {
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters");
        await apiPost("/admin/admins", { ...common, email: form.email, password: form.password });
      }
      setFeedback(editingId ? "Admin updated successfully" : "Admin created successfully");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to save admin");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permission: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setFeedback("");
    try {
      if (resetPassword.length < 8) throw new Error("Password must be at least 8 characters");
      await apiPost(`/admin/admins/${resetTarget.id ?? resetTarget._id}/reset-password`, {
        password: resetPassword,
      });
      setResetTarget(null);
      setResetPassword("");
      setFeedback("Password reset — all previous sessions revoked");
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  const revokeSessions = async (a: AdminRecord) => {
    setSaving(true);
    setFeedback("");
    try {
      await apiPost(`/admin/admins/${a.id ?? a._id}/revoke-sessions`, {});
      setFeedback("Sessions revoked for this admin");
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to revoke sessions");
    } finally {
      setSaving(false);
    }
  };

  const roleBadge =
    "inline-block px-2 py-1 text-xs rounded-full " +
    (isSuperAdmin
      ? "bg-red-100 text-red-700"
      : "bg-blue-100 text-blue-700");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Management</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Admin
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Super Admin only. Create and manage admin accounts, assign fine-grained permissions, disable
        access, reset passwords and revoke sessions.
      </p>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading admins...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm ${
            feedback.includes("successful") || feedback.includes("revoked")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a._id ?? a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.email}</div>
                    <div className="text-xs text-gray-500">
                      {a.name || a.username}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={roleBadge}>{a.role.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        a.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(a.permissions ?? []).slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded"
                        >
                          {p}
                        </span>
                      ))}
                      {(a.permissions ?? []).length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
                          +{(a.permissions ?? []).length - 3}
                        </span>
                      )}
                      {(a.permissions ?? []).length === 0 && (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(a)}
                        className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setResetTarget(a)}
                        className="px-2.5 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => revokeSessions(a)}
                        disabled={saving}
                        className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No admin accounts found
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
              {editingId ? "Edit Admin" : "Create New Admin"}
            </h3>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editingId}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {PERMISSION_GROUPS.map((group) => {
                    const value: AdminPermissionValue = group.value;
                    const checked = form.permissions.includes(value);
                    return (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(value)}
                          className="rounded text-blue-600"
                        />
                        <span className={checked ? "text-gray-900" : "text-gray-500"}>
                          {group.label}
                        </span>
                        <code className="ml-auto text-[10px] text-gray-400">{value}</code>
                      </label>
                    );
                  })}
                </div>
              </div>
              {feedback && (
                <div
                  className={`px-3 py-2 rounded text-sm ${
                    feedback.includes("successful")
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {feedback}
                </div>
              )}
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
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              {resetTarget.email} — this will revoke all existing sessions.
            </p>
            <form onSubmit={submitReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}