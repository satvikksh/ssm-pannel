"use client";

import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiGet, apiPost } from "./api";

export interface AdminLicenseInfo {
  granted: boolean;
  code: string;
  message: string;
  licenseId?: string;
  status?: string;
  expiresAt?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
  referralCode: string;
  createdAt: string;
  adminLicense?: AdminLicenseInfo;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  licenseBlocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  canAccess: (permission?: string) => boolean;
  activateLicense: (licenseKey: string, domain: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_ROLES = ["admin", "super_admin"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAdminRole = (role: string) => ADMIN_ROLES.includes(role);

  const licenseBlocked =
    !!user &&
    user.role === "admin" &&
    (user.adminLicense ? user.adminLicense.granted !== true : true);

  const canAccess = useCallback(
    (permission?: string) => {
      if (!user) return false;
      if (user.role === "super_admin") return true;
      if (!permission) return true;
      return (user.permissions ?? []).includes(permission);
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("admin-token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiGet<User>("/auth/me");
      if (!isAdminRole(me.role)) {
        localStorage.removeItem("admin-token");
        setUser(null);
        router.push("/login");
      } else {
        setUser(me);
      }
    } catch {
      localStorage.removeItem("admin-token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!loading && !user && !pathname.startsWith("/login")) {
      router.push("/login");
    }
    if (!loading && user && licenseBlocked && pathname.startsWith("/dashboard")) {
      router.push("/license");
    }
    if (!loading && user && !licenseBlocked && pathname === "/license") {
      router.push("/dashboard");
    }
  }, [loading, user, licenseBlocked, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(err.message || "Login failed");
    }
    const data = await res.json();
    const payload =
      data &&
      typeof data === "object" &&
      "success" in data &&
      "data" in data &&
      (data as { success?: unknown }).success === true
        ? (data as { data: { accessToken?: string } }).data
        : (data as { accessToken?: string });
    localStorage.setItem("admin-token", payload.accessToken || "");
    const me = await apiGet<User>("/auth/me");
    if (!isAdminRole(me.role)) {
      localStorage.removeItem("admin-token");
      throw new Error("Access denied — admin only");
    }
    setUser(me);
    if (me.role === "admin" && me.adminLicense && me.adminLicense.granted !== true) {
      router.push("/license");
    } else {
      router.push("/dashboard");
    }
  };

  const activateLicense = async (licenseKey: string, domain: string) => {
    await apiPost("/license/activate", { licenseKey, domain });
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem("admin-token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, licenseBlocked, login, logout, refreshUser, canAccess, activateLicense }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
