"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, clearToken, getToken, setToken } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  role: string;
  status: string;
  referralCode?: string | null;
  walletBalance: number;
  flags?: Record<string, unknown>;
  createdAt: string;
}

interface LoginResponse {
  accessToken?: string;
  token?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    name?: string,
    referralCode?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      setUser(await apiGet<AuthUser>("/auth/me"));
    } catch {
      setUser(null);
      clearToken();
      setTokenState(null);
    }
  }, []);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setTokenState(stored);
    apiGet<AuthUser>("/auth/me")
      .then((me) => setUser(me))
      .catch(() => {
        setUser(null);
        clearToken();
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<LoginResponse>("/auth/login", {
      email,
      password,
    });
    const accessToken = data.accessToken || data.token;
    if (accessToken) {
      setToken(accessToken);
      setTokenState(accessToken);
    }
    const me = data.user ?? (await apiGet<AuthUser>("/auth/me"));
    setUser(me);
  }, []);

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      name?: string,
      referralCode?: string,
    ) => {
      const data = await apiPost<{
        user?: AuthUser;
        accessToken?: string;
        token?: string;
      }>("/auth/register", {
        email,
        username,
        password,
        ...(name ? { name } : {}),
        ...(referralCode ? { referralCode } : {}),
      });
      const accessToken = data.accessToken || data.token;
      if (accessToken) {
        setToken(accessToken);
        setTokenState(accessToken);
      }
      if (data.user) setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      if (getToken()) await apiPost("/auth/logout", {});
    } catch {
      // ignore server errors during logout
    }
    clearToken();
    setTokenState(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}