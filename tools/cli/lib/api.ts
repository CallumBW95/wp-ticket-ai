import { logger } from "./io";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function resolveBaseUrl(override?: string): string {
  if (override) return override.replace(/\/$/, "");
  const fromEnv = process.env.VITE_API_BASE_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : undefined);
  return (fromEnv || "http://localhost:3001").replace(/\/$/, "");
}

export function createApiClient(baseOverride?: string, timeoutMs: number = 15000) {
  const base = resolveBaseUrl(baseOverride);

  async function request(pathOrUrl: string, init?: RequestInit) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${base}${pathOrUrl}`;
    const res = await withTimeout(fetch(url, init), timeoutMs);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = `HTTP ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`;
      throw new Error(msg);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  return {
    get: (path: string) => request(path),
    post: (path: string, body?: unknown) =>
      request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }),
  };
}