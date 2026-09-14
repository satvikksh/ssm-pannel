"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { NAV_ENTRIES } from "@/lib/permissions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, canAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const entry = NAV_ENTRIES.find((e) => pathname === e.href || pathname.startsWith(`${e.href}/`));
  const allowed = !entry || canAccess(entry.permission);
  if (!allowed) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-10 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">403 — Access denied</h1>
            <p className="text-gray-600">
              Your account does not have the permission to view this page. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
