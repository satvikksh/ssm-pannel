"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
} from "@/components/ui";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SettingsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    apiGet<Record<string, unknown>>("/settings/public")
      .then((res) => {
        if (!mounted) return;
        setData(res ?? null);
      })
      .catch((e) => {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load settings.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Public panel settings and announcements."
      />

      <ErrorBox message={error} />

      {!data || Object.keys(data).length === 0 ? (
        <EmptyState text="No settings have been published yet." />
      ) : (
        <div className="space-y-6">
          {Object.entries(data).map(([group, value]) => (
            <Card key={group}>
              <h2 className="mb-3 text-base font-semibold capitalize text-gray-900">
                {group.replace(/[_]/g, " ")}
              </h2>
              {value && typeof value === "object" ? (
                <dl className="space-y-2 text-sm">
                  {Object.entries(value as Record<string, unknown>).map(
                    ([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-4 border-b border-gray-100 pb-1.5"
                      >
                        <dt className="capitalize text-gray-500">
                          {k.replace(/[_]/g, " ")}
                        </dt>
                        <dd className="text-right font-medium text-gray-900">
                          {formatValue(v)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-600">{formatValue(value)}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}