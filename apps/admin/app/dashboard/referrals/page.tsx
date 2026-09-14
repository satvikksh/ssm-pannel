"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Referral {
  _id: string;
  referrerId?: string | { username?: string; email?: string };
  referredUserId?: string | { username?: string; email?: string; createdAt?: string };
  createdAt?: string;
  [key: string]: unknown;
}

interface ReferralsData {
  items?: Referral[];
  referrals?: Referral[];
}

interface CommissionStatus {
  _id: string;
  total: number;
  count: number;
}

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<CommissionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [refData, commData] = await Promise.all([
          apiGet<ReferralsData | Referral[]>("/referrals/admin/all").catch(() => []),
          apiGet<CommissionStatus[] | { data?: CommissionStatus[] }>("/referrals/admin/commissions").catch(() => []),
        ]);
        const list = Array.isArray(refData)
          ? refData
          : (refData as ReferralsData).items || (refData as ReferralsData).referrals || [];
        setReferrals(list);
        const commArray = Array.isArray(commData)
          ? commData
          : (commData as { data?: CommissionStatus[] }).data || [];
        setCommissions(commArray);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load referrals");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const userDisplay = (obj: unknown) => {
    if (obj && typeof obj === "object") {
      const u = obj as { username?: string; email?: string };
      return u.username || u.email || "—";
    }
    return String(obj || "—");
  };

  const totalCommission = commissions.reduce((sum, c) => sum + (c.total || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Referrals</h1>

      {loading && <div className="text-center py-8 text-gray-500">Loading referrals...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Total Referrals</p>
              <p className="text-2xl font-bold">{referrals.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Total Commission Earned</p>
              <p className="text-2xl font-bold">${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-500 mb-1">Commission Records</p>
              <p className="text-2xl font-bold">{commissions.reduce((s, c) => s + (c.count || 0), 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3">Referrer</th>
                  <th className="px-4 py-3">Referred User</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r, i) => (
                  <tr key={r._id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                    <td className="px-4 py-3">{userDisplay(r.referrerId)}</td>
                    <td className="px-4 py-3">{userDisplay(r.referredUserId)}</td>
                    <td className="px-4 py-3">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {referrals.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      No referrals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}