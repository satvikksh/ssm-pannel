"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const FEATURES = [
  {
    title: "Services",
    desc: "Browse hundreds of social media services with transparent per-1000 pricing.",
  },
  {
    title: "Instant Orders",
    desc: "Create orders in seconds and track every order from pending to complete.",
  },
  {
    title: "Smart Wallet",
    desc: "A unified balance with deposits, refills, drip feeds and subscriptions.",
  },
  {
    title: "24/7 Support",
    desc: "Open tickets, track replies and get help whenever you need it.",
  },
  {
    title: "Referral Rewards",
    desc: "Earn commission every time someone you invite places an order.",
  },
  {
    title: "Developer API",
    desc: "Manage orders and balance programmatically with API keys.",
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="text-xl font-bold text-blue-600">SMM Panel</div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Social Media Marketing,{" "}
            <span className="text-blue-600">Simplified</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Grow your presence across Instagram, YouTube, TikTok, Telegram and
            more. Choose a service, place an order, and let us handle the rest.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign In
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-gray-200 bg-gray-50 p-6"
            >
              <h2 className="text-base font-semibold text-gray-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} SMM Panel
      </footer>
    </div>
  );
}