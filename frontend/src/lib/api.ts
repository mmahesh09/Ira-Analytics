import type { AuditEvent } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const EVENT_TYPES = ["stage", "module", "warning", "result", "error"] as const;

/** Opens the audit event stream. Returns a function that closes it. */
export function streamAudit(url: string, onEvent: (event: AuditEvent) => void): () => void {
  const source = new EventSource(`${API_URL}/api/audit/stream?url=${encodeURIComponent(url)}`);
  let finished = false;

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as AuditEvent;
      if (event.type === "result" || event.type === "error") {
        finished = true;
        source.close();
      }
      onEvent(event);
    });
  }

  source.onerror = () => {
    if (finished) return;
    finished = true;
    source.close();
    onEvent({ type: "error", message: "Our audit service isn't reachable right now, so we couldn't check this site. Please try again in a few minutes." });
  };

  return () => {
    finished = true;
    source.close();
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Same-origin call to the platform API (proxied by next.config rewrites). Throws ApiError with the server's message. */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { ...(init.body === undefined ? {} : { "Content-Type": "application/json" }), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? (detail[0]?.msg ?? "Check the form and try again.") : "Something went wrong. Try again.";
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

/** Accepts "example.com", "www.example.com/path" or full URLs. Returns null if it can't be a public site. */
export function cleanUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
