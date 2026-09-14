"use client";

import { AuthProvider as AuthCtxProvider } from "@/lib/auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthCtxProvider>{children}</AuthCtxProvider>;
}
