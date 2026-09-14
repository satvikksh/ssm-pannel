"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { formatMoney, parseFloatSafe } from "@/lib/format";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
  SuccessBox,
} from "@/components/ui";

interface PriceResponse {
  price?: number;
  rate?: number;
  ratePer1000?: number;
  service?: {
    id: string;
    name?: string;
    min?: number;
    max?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OrderResult {
  publicOrderId?: string;
  orderId?: string;
  id?: string;
  message?: string;
}

export default function ServiceOrderPage() {
  const params = useParams<{ id: string }>();
  const serviceId = params.id;

  const [service, setService] = useState<PriceResponse["service"] | null>(null);
  const [ratePer1000, setRatePer1000] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!serviceId) return;
    (async () => {
      try {
        const data = await apiGet<PriceResponse>(
          `/services/${serviceId}/price?quantity=1000`,
        );
        if (!mounted) return;
        setService(data.service ?? {
          id: serviceId,
          min: 1,
          max: undefined as unknown as number,
        });
        setRatePer1000(
          parseFloatSafe(
            data.rate ?? data.ratePer1000 ?? data.price ?? 0,
          ),
        );
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load service pricing.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [serviceId]);

  const min = parseFloatSafe(service?.min ?? 1);
  const max = service?.max != null ? parseFloatSafe(service?.max) : null;
  const qty = parseFloatSafe(quantity);
  const estimatedPrice = qty > 0 ? (ratePer1000 * qty) / 1000 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const data = await apiPost<OrderResult>("/orders", {
        serviceId,
        link,
        quantity: qty,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      });
      setResult(data);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to place order.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Order ${service?.name || serviceId}`}
        subtitle="Place a new order for this service."
      />

      <ErrorBox message={error} />
      {result ? (
        <Card>
          <SuccessBox message="Order placed successfully!" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ID</span>
              <span className="font-mono font-medium">
                {result.publicOrderId || result.orderId || result.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Quantity</span>
              <span>{qty}</span>
            </div>
            {result.message ? (
              <p className="text-gray-600">{result.message}</p>
            ) : null}
          </div>
          <div className="mt-4">
            <Link
              href="/dashboard/orders"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View My Orders
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-md bg-gray-50 p-4 text-sm">
            <div>
              <div className="text-gray-500">Rate / 1000</div>
              <div className="font-medium">₹ {formatMoney(ratePer1000)}</div>
            </div>
            <div>
              <div className="text-gray-500">Min - Max</div>
              <div className="font-medium">
                {min} - {max ?? "∞"}
              </div>
            </div>
          </div>

          <ErrorBox message={submitError} />
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Service Link">
              <input
                type="url"
                required
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="https://instagram.com/yoursocial/profile"
              />
            </Field>
            <Field
              label="Quantity"
              hint={
                max != null
                  ? `Between ${min} and ${max}`
                  : `At least ${min}`
              }
            >
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  required
                  min={min}
                  max={max ?? undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={`Min ${min}`}
                />
                <div className="shrink-0 text-sm text-gray-500">
                  Est. ₹ {formatMoney(estimatedPrice)}
                </div>
              </div>
            </Field>
            <Field label="Coupon Code (optional)">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="PROMO10"
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Place Order"}
              </Button>
              <Link
                href="/dashboard/services"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Services
              </Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}