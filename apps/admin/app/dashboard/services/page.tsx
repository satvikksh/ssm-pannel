"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Service {
  id: string;
  name: string;
  category?: string | { id: string; name: string };
  rate?: number;
  price?: number;
  min?: number;
  max?: number;
  status?: string;
  provider?: string | { id: string; name: string };
  createdAt?: string;
}

interface ServicesResponse {
  data?: Service[];
  services?: Service[];
  items?: Service[];
  total?: number;
}

interface Category {
  id: string;
  name: string;
  slug?: string;
  status?: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [servicesData, categoriesData] = await Promise.all([
          apiGet<ServicesResponse>("/services?page=1&pageSize=50"),
          apiGet<Category[]>("/services/categories").catch(() => []),
        ]);
        const list = servicesData.data || servicesData.services || servicesData.items || [];
        setServices(list);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load services");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered =
    categoryFilter && categoryFilter !== "all"
      ? services.filter((s) => {
          const cat = s.category;
          if (typeof cat === "object" && cat) return cat.name === categoryFilter;
          return cat === categoryFilter;
        })
      : services;

  const getCategoryName = (s: Service) => {
    if (typeof s.category === "object" && s.category) return s.category.name;
    return s.category || "—";
  };

  const getProviderName = (s: Service) => {
    if (typeof s.provider === "object" && s.provider) return s.provider.name;
    return s.provider || "—";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Services</h1>
      <div className="flex gap-3 mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">
          {filtered.length} service{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading services...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Max</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-100 ${
                    i % 2 === 1 ? "bg-gray-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{getCategoryName(s)}</td>
                  <td className="px-4 py-3">${Number(s.rate ?? s.price ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">{s.min ?? "—"}</td>
                  <td className="px-4 py-3">{s.max ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        String(s.status ?? "active").toLowerCase() === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status ?? "active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getProviderName(s)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No services found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}