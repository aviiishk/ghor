// Browser-side helper. It only ever calls this app's own BFF (/api/admin/*, /api/auth/*);
// it holds no tokens (they live in httpOnly cookies) and makes no authorization
// decisions — the API does.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isStepUpRequired = (e: unknown) => e instanceof ApiError && e.code === "STEP_UP_REQUIRED";

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  opts: { background?: boolean } = {}
): Promise<T> {
  const url = path.startsWith("/api/") ? path : `/api/admin${path}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      "content-type": "application/json",
      ...(opts.background ? { "x-admin-background": "1" } : {})
    },
    credentials: "same-origin",
    cache: "no-store"
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const code = typeof data.code === "string" ? data.code : undefined;
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : typeof data.message === "string"
        ? data.message
        : `Request failed (${res.status})`;
    // Session over (idle/absolute timeout, logout elsewhere, revoked) → back to sign-in.
    if (res.status === 401 && code !== "STEP_UP_REQUIRED" && !url.startsWith("/api/auth/")) {
      window.location.assign("/sign-in?expired=1");
    }
    throw new ApiError(res.status, message, code, data);
  }
  return data as T;
}
