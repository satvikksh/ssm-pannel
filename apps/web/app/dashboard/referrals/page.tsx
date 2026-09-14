"use client";

import { useEffect, useState } from "react";
import { apiGet, asList } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  Table,
  Td,
} from "@/components/ui";

interface Referral {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  createdAt?: string;
  created?: string;
  [key: string]: unknown;
}

export default function ReferralsPage() {
  const { user, refreshUser } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commission, setCommission] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [refData, commData] = await Promise.all([
          apiGet<unknown>("/referrals/my"),
          apiGet<unknown>("/referrals/commission"),
        ]);
        if (!mounted) return;
        setReferrals(asList<Referral>(refData, "referrals"));
        setCommission(
          commData && typeof commData === "object"
            ? (commData as Record<string, unknown>)
            : null,
        );
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load referrals.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <Spinner />;

  const commissionEntries = commission
    ? Object.entries(commission).filter(([k]) =>
        !["id", "userId", "createdAt", "updatedAt"].includes(k) &&
        !["_count", "referralCount"].includes(k),
      )
    : [];

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle="Earn commission by inviting friends to the panel."
      />
      <ErrorBox message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="text-sm font-medium text-gray-500">
              Your Referral Code
            </div>
            <div className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-center font-mono text-lg font-semibold text-blue-700">
              {user?.referralCode || "—"}
            </div>
            <button
              onClick={() => {
                void refreshUser();
                if (user?.referralCode && navigator.clipboard) {
                  void navigator.clipboard.writeText(user.referralCode);
                }
              }}
              className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Copy Code
            </button>
          </Card>

          {commissionEntries.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Commission Summary
              </h2>
              <dl className="space-y-2 text-sm">
                {commissionEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="capitalize text-gray-500">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="font-medium text-gray-900">
                      {typeof value === "number" || typeof value === "string"
                        ? typeof value === "number"
                          ? `₹ ${formatMoney(value)}`
                          : value
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Referred Users
          </h2>
          {referrals.length === 0 ? (
            <EmptyState text="No referrals yet. Share your code to start earning." />
          ) : (
            <Table headers={["User", "Email", "Joined"]}>
              {referrals.map((ref) => (
                <tr key={ref.id}>
                  <Td>{ref.username || ref.name || "—"}</Td>
                  <Td>{ref.email || "—"}</Td>
                  <Td>{formatDate(ref.createdAt ?? ref.created)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}