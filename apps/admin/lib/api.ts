const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin-token");
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const body = data as {
      message?: unknown;
      error?: string | { message?: string };
    };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join(", ");
    }
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error === "object" && typeof body.error.message === "string") {
      return body.error.message;
    }
  }
  return fallback;
}

function unwrap<T>(data: unknown): T {
  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    "data" in data &&
    (data as { success?: unknown }).success === true
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `GET ${path} failed` }));
    throw new Error(errorMessage(error, `GET ${path} failed`));
  }
  return unwrap<T>(await res.json());
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `POST ${path} failed` }));
    throw new Error(errorMessage(error, `POST ${path} failed`));
  }
  return unwrap<T>(await res.json());
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `PATCH ${path} failed` }));
    throw new Error(errorMessage(error, `PATCH ${path} failed`));
  }
  return unwrap<T>(await res.json());
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `DELETE ${path} failed` }));
    throw new Error(errorMessage(error, `DELETE ${path} failed`));
  }
  try {
    return unwrap<T>(await res.json());
  } catch {
    return undefined as T;
  }
}
