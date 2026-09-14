"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, asList } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
} from "@/components/ui";

interface Category {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  rate?: number;
  ratePer1000?: number;
  pricePer1000?: number;
  min?: number;
  max?: number;
  category?: { name?: string } | string;
}

function categoryName(service: Service): string {
  if (typeof service.category === "string") return service.category;
  if (service.category && typeof service.category === "object") {
    return (service.category as { name?: string }).name ?? "—";
  }
  return "—";
}

function rateOf(service: Service): number {
  const value = service.rate ?? service.ratePer1000 ?? service.pricePer1000;
  return Number(value) || 0;
}

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    apiGet<unknown>("/services/categories")
      .then((data) => {
        if (mounted) setCategories(asList<Category>(data, "categories"));
      })
      .catch((e) => {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load categories.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      (async () => {
        try {
          const params = new URLSearchParams();
          if (selectedCategory !== "all") params.set("categoryId", selectedCategory);
          if (search.trim()) params.set("search", search.trim());
          const qs = params.toString();
          const data = await apiGet<unknown>(`/services${qs ? `?${qs}` : ""}`);
          if (mounted) setServices(asList<Service>(data, "services"));
        } catch (e) {
          if (mounted)
            setError(e instanceof Error ? e.message : "Failed to load services.");
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    }, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [selectedCategory, search]);

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Browse available services and start a new order."
      />

      <ErrorBox message={error} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                selectedCategory === category.id
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : services.length === 0 ? (
        <EmptyState text="No services found. Try a different filter or search term." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                {categoryName(service)}
              </div>
              <h2 className="mt-1 text-base font-semibold text-gray-900">
                {service.name}
              </h2>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Rate / 1000</dt>
                  <dd className="font-medium text-gray-900">
                    ₹ {formatMoney(rateOf(service))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Min - Max</dt>
                  <dd className="text-gray-900">
                    {service.min ?? 1} - {service.max ?? "∞"}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/dashboard/services/${service.id}/order`}
                className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Order
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}