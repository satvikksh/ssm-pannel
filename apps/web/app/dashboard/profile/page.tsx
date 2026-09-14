"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  PageHeader,
  SuccessBox,
} from "@/components/ui";

function labelOf(key: string): string {
  return key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const flags = user?.flags && typeof user.flags === "object" ? user.flags : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Profile"
        subtitle="Your account details and security settings."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Account Details
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Name", user?.name || "—"],
              ["Username", user?.username || "—"],
              ["Email", user?.email || "—"],
              ["Referral Code", user?.referralCode || "—"],
              ["Member Since", formatDate(user?.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Account Security
            </h2>
            <dl className="space-y-3 text-sm">
              {[
                ["Email Verified", flags?.emailVerified ? "Yes" : "No"],
                ["Two-Factor Auth", flags?.twoFactorEnabled ? "Enabled" : "Disabled"],
                ["API Access", flags?.apiAccess ? "Enabled" : "Disabled"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
              {flags
                ? Object.entries(flags)
                    .filter(
                      ([k]) =>
                        !["emailVerified", "twoFactorEnabled", "apiAccess"].includes(k),
                    )
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <dt className="text-gray-500">{labelOf(k)}</dt>
                        <dd className="font-medium text-gray-900">
                          {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                        </dd>
                      </div>
                    ))
                : null}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Change Password
            </h2>
            <ErrorBox message={error} />
            <SuccessBox message={success} />
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Current Password">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              <Field label="New Password">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="At least 6 characters"
                />
              </Field>
              <Field label="Confirm New Password">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Repeat new password"
                />
              </Field>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}