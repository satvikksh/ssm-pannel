"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LicenseGatePage() {
  const { user, activateLicense, logout, loading } = useAuth();
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [domain, setDomain] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Checking license…</p>
      </div>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  const info = user.adminLicense;

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivating(true);
    setError("");
    setFeedback("");
    try {
      await activateLicense(licenseKey, domain);
      setFeedback("License activated successfully.");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate license");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-2">License Required</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your ADMIN access is linked to a license issued by the Super Admin.
          </p>

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

          <div className="mb-6 p-4 rounded bg-gray-50 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-mono text-xs">
                {info?.status ?? "unknown"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Error code</span>
              <span className="font-mono text-xs">{info?.code ?? "LICENSE_NOT_FOUND"}</span>
            </div>
            <p className="text-gray-600">{info?.message ?? "No license assigned to this account yet."}</p>
            {info?.expiresAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Expires</span>
                <span>{new Date(info.expiresAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
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
              {activating ? "Activating…" : "Activate License"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}