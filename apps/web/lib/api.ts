const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const TOKEN_KEY = "auth-token";

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

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  fields: string[];

  constructor(message: string, status: number, code?: string, fields?: string[]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields ?? [];
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  setToken(null);
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (options.body !== undefined && options.body !== null) {
    body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body,
  } as RequestInit);

  if (response.status === 401) {
    clearToken();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const raw = (data ?? {}) as {
      message?: unknown;
      error?:
        | string
        | {
            message?: string;
            code?: string;
            details?: { fields?: unknown };
          };
      details?: { fields?: unknown };
    };
    let message: string | undefined;
    let code: string | undefined;
    let fields: string[] = [];

    if (raw && typeof raw === "object") {
      const errObj = raw.error;
      if (typeof errObj === "string") message = errObj;
      else if (errObj && typeof errObj === "object") {
        if (typeof errObj.message === "string") message = errObj.message;
        code = typeof errObj.code === "string" ? errObj.code : undefined;
      }
      if (!message && typeof raw.message === "string") message = raw.message;
      if (Array.isArray(raw.message) && raw.message.length > 0) {
        message = raw.message.join(", ");
      }

      const details =
        (raw.details as { fields?: unknown } | undefined) ??
        (errObj && typeof errObj === "object" ? (errObj as { details?: unknown }).details : undefined);
      const fieldArr =
        details && typeof details === "object" && Array.isArray((details as { fields?: unknown }).fields)
          ? ((details as { fields?: unknown }).fields as unknown[])
          : [];
      fields = fieldArr.map((f) => String(f));
    }

    throw new ApiRequestError(
      message || `Request failed with status ${response.status}`,
      response.status,
      code,
      fields,
    );
  }

  return unwrap<T>(data);
}

export const apiGet = <T,>(path: string): Promise<T> => apiFetch<T>(path);

export const apiPost = <T,>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "POST", body });

export const apiPatch = <T,>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "PATCH", body });

export function asList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of [...keys, "data", "items", "results", "records", "list"]) {
      const value = obj[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}