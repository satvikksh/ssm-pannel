"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Category {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  serviceCount?: number;
}

interface ServicesResponse {
  data?: Array<{ category?: string | { name: string } }>;
  services?: Array<{ category?: string | { name: string } }>;
  items?: Array<{ category?: string | { name: string } }>;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<Category[] | { data?: Category[]; categories?: Category[] }>(
          "/services/categories"
        );
        const list = Array.isArray(data)
          ? data
          : data.data || data.categories || [];
        setCategories(list);

        const servicesData = (await apiGet<ServicesResponse>(
          "/services?page=1&pageSize=50"
        ).catch(() => null)) as ServicesResponse;
        const services = servicesData?.data || servicesData?.services || servicesData?.items || [];
        const countMap: Record<string, number> = {};
        for (const s of services) {
          if (typeof s.category === "string" && s.category) {
            countMap[s.category] = (countMap[s.category] || 0) + 1;
          } else if (typeof s.category === "object" && s.category?.name) {
            countMap[s.category.name] = (countMap[s.category.name] || 0) + 1;
          }
        }
        setCounts(countMap);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load categories");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading categories...</div>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>
      {categories.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          No categories found. Note: there is no category create endpoint in the API.
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Service Count</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.slug || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      String(c.status ?? "active").toLowerCase() === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.status ?? "active"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.serviceCount ?? counts[c.name] ?? 0}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No categories found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}