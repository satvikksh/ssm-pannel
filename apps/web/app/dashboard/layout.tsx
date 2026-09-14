"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";

interface SocialLink {
  key: string;
  label: string;
  url: string;
  enabled: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    apiGet<SocialLink[]>("/settings/social")
      .then((data) => setSocialLinks(Array.isArray(data) ? data : []))
      .catch(() => setSocialLinks([]));
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-x-auto p-6">
        {children}
      </main>
      {socialLinks.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow">
          {socialLinks.map((s) => (
            <a
              key={s.key}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 hover:text-blue-400"
              title={s.label}
            >
              {s.key === "youtube" ? "▶ YouTube" : "✈ Telegram"}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}