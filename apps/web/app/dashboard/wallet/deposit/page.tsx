"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { formatMoney, parseFloatSafe } from "@/lib/format";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  PageHeader,
  SuccessBox,
} from "@/components/ui";

interface DepositResult {
  message?: string;
  publicDepositId?: string;
  depositId?: string;
  id?: string;
  redirectUrl?: string;
  [key: string]: unknown;
}

interface PaymentMethod {
  code: string;
  name: string;
  type: string;
  enabled: boolean;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
}

const CURRENCY_SYMBOL = "₹";

export default function DepositPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [methodCode, setMethodCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DepositResult | null>(null);
  const [error, setError] = useState("");

  const parsedAmount = parseFloatSafe(amount);

  useEffect(() => {
    apiGet<PaymentMethod[]>("/payments/methods")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMethods(list);
        if (list.length > 0) setMethodCode(list[0].code);
      })
      .catch(() => setError("Failed to load payment methods"))
      .finally(() => setMethodsLoaded(true));
  }, []);

  const selectedMethod = methods.find((m) => m.code === methodCode);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiPost<DepositResult>("/payments/deposit", {
        amount: parsedAmount,
        methodCode,
        gateway: selectedMethod?.type || methodCode,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create deposit.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Add Funds"
        subtitle="Top up your wallet to place orders."
      />

      <ErrorBox message={error} />

      {result ? (
        <Card>
          <SuccessBox
            message={result.message || "Deposit created successfully!"}
          />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium">
                {CURRENCY_SYMBOL}
                {formatMoney(parsedAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="font-medium">{selectedMethod?.name ?? methodCode}</span>
            </div>
            {selectedMethod?.instructions ? (
              <p className="text-xs text-gray-500">{selectedMethod.instructions}</p>
            ) : null}
            {result.publicDepositId || result.depositId || result.id ? (
              <div className="flex justify-between">
                <span className="text-gray-500">Deposit ID</span>
                <span className="font-mono font-medium">
                  {result.publicDepositId || result.depositId || result.id}
                </span>
              </div>
            ) : null}
            {result.redirectUrl ? (
              <div className="pt-2">
                <a
                  href={result.redirectUrl as string}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Complete Payment
                </a>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Link
              href="/dashboard/wallet"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Back to Wallet
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          {!methodsLoaded ? (
            <p className="text-sm text-gray-500">Loading payment methods…</p>
          ) : methods.length === 0 ? (
            <p className="text-sm text-gray-500">
              No payment methods are enabled right now. Please contact support.
              {" "}
              <Link
                href="/dashboard/wallet"
                className="text-blue-600 hover:underline"
              >
                Back to Wallet
              </Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label={`Amount (${CURRENCY_SYMBOL} INR)`}
                hint="You will be charged this amount."
              >
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="100.00"
                />
              </Field>
              <Field label="Payment Method" hint="Select how you want to pay.">
                <select
                  value={methodCode}
                  onChange={(e) => setMethodCode(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {methods.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedMethod?.instructions ? (
                <p className="text-xs text-gray-500">{selectedMethod.instructions}</p>
              ) : null}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting || parsedAmount <= 0}>
                  {submitting ? "Submitting..." : "Request Deposit"}
                </Button>
                <Link
                  href="/dashboard/wallet"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}