"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, asList } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  Table,
  Td,
} from "@/components/ui";

interface Transaction {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  createdAt?: string;
  created?: string;
  [key: string]: unknown;
}

interface WalletData {
  balance?: number;
  wallet?: { balance?: number };
}

function balanceOf(data: WalletData | null): number {
  const b = data?.balance ?? data?.wallet?.balance;
  return typeof b === "number" ? b : b != null ? Number(b) : 0;
}

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [walletData, txData] = await Promise.all([
          apiGet<WalletData>("/wallet"),
          apiGet<unknown>("/wallet/transactions?page=1&pageSize=20"),
        ]);
        if (!mounted) return;
        setBalance(balanceOf(walletData));
        setTransactions(asList<Transaction>(txData, "transactions"));
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load wallet data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Wallet" subtitle="Your balance and transaction history." />
        <Link href="/dashboard/wallet/deposit">
          <Button>Add Funds</Button>
        </Link>
      </div>

      <ErrorBox message={error} />

      <Card className="mb-6 max-w-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="text-sm text-blue-100">Available Balance</div>
        <div className="mt-2 text-3xl font-bold">
          ₹ {formatMoney(balance ?? 0)}
        </div>
      </Card>

      {transactions.length === 0 ? (
        <EmptyState text="No transactions yet." />
      ) : (
        <Table headers={["Type", "Amount", "Description", "Date"]}>
          {transactions.map((tx) => {
            const amount = parseFloatSafeAmount(tx.amount);
            const negative = amount < 0;
            return (
              <tr key={tx.id}>
                <Td>
                  <span className="capitalize">{tx.type || "—"}</span>
                </Td>
                <Td
                  className={
                    negative
                      ? "font-medium text-red-600"
                      : "font-medium text-green-600"
                  }
                >
                  {negative ? "-" : "+"}₹ {formatMoney(Math.abs(amount))}
                </Td>
                <Td>{tx.description || "—"}</Td>
                <Td>{formatDate(tx.createdAt ?? tx.created)}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}

function parseFloatSafeAmount(value: unknown): number {
  const num = Number(value ?? 0);
  return isNaN(num) ? 0 : num;
}