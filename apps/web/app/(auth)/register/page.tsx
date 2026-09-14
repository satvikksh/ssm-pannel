"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiRequestError } from "@/lib/api";

const USERNAME_PATTERN = /^[a-z0-9_.]+$/i;

type FieldErrors = {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
};

function fieldKeyFromMessage(msg: string): keyof FieldErrors | null {
  const head = (msg.split(" ")[0] || "").toLowerCase();
  if (head.startsWith("email")) return "email";
  if (head.startsWith("username")) return "username";
  if (head.startsWith("password")) return "password";
  return null;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});

    const localErrors: FieldErrors = {};
    if (password.length < 8) {
      localErrors.password = "Password must be at least 8 characters.";
    }
    if (confirmPassword !== password) {
      localErrors.confirmPassword = "Passwords do not match.";
    }
    if (!USERNAME_PATTERN.test(username)) {
      localErrors.username =
        "Username can only contain letters, numbers, underscores, and dots.";
    }
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      if (localErrors.password || localErrors.confirmPassword) {
        setError("Please fix the highlighted fields.");
      }
      return;
    }

    setSubmitting(true);
    try {
      await register(
        email,
        username,
        password,
        name.trim() || undefined,
        referralCode.trim() || undefined,
      );
      setSuccess("Account created! Redirecting to your dashboard...");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields.length > 0) {
        const mapped: FieldErrors = {};
        let hasPasswordFieldError = false;
        for (const m of err.fields) {
          const key = fieldKeyFromMessage(m);
          if (key === "password") hasPasswordFieldError = true;
          if (key && !mapped[key]) mapped[key] = m;
        }
        mapped.confirmPassword = hasPasswordFieldError
          ? mapped.confirmPassword ?? undefined
          : undefined;
        setFieldErrors(mapped);
      }
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          SMM Panel
        </h1>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Create Account
        </h2>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                fieldErrors.email
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              placeholder="you@example.com"
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                fieldErrors.username
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              placeholder="your_username"
            />
            {fieldErrors.username ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                fieldErrors.password
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              placeholder="At least 8 characters"
            />
            {fieldErrors.password ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                fieldErrors.confirmPassword
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              placeholder="Repeat your password"
            />
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Referral Code{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Referral code if you have one"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}