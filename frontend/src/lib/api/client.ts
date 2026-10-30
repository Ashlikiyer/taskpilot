import type { components } from "./schema";

export type Schemas = components["schemas"];

const API_PREFIX = "/api/v1";

/** An error response in the backend's `{ error: { code, message, details } }` format. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The access token lives only in memory (never localStorage); the refresh token
// is an HttpOnly cookie the browser sends to /api/v1/auth automatically.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Get a new access token from the refresh cookie. Concurrent callers share one
 * request, because refresh tokens rotate and a second refresh would look like reuse.
 */
export function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const body = (await response.json()) as Schemas["TokenResponse"];
      accessToken = body.access_token;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (body.error?.code) {
      return new ApiError(
        response.status,
        body.error.code,
        body.error.message ?? "Request failed",
        body.error.details ?? null,
      );
    }
  } catch {
    // Not JSON (for example the backend is down and the proxy returned HTML).
  }
  return new ApiError(
    response.status,
    "HTTP_ERROR",
    `Request failed (${response.status})`,
  );
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  // After a page load the token is gone from memory; restore it from the cookie first.
  if (!accessToken) await refreshAccessToken();

  const send = () => {
    const headers = new Headers();
    // File uploads send FormData; the browser sets its multipart Content-Type.
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm)
      headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isForm
            ? (body as FormData)
            : JSON.stringify(body),
      credentials: "same-origin",
    });
  };

  let response = await send();
  if (response.status === 401) {
    const error = await toApiError(response.clone());
    if (error.code === "TOKEN_EXPIRED" && (await refreshAccessToken())) {
      response = await send();
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

/** Auth endpoints that must not trigger the automatic refresh above. */
export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
    });
    if (!response.ok) throw await toApiError(response);
    const body = (await response.json()) as Schemas["TokenResponse"];
    accessToken = body.access_token;
  },
  async register(data: Schemas["RegisterRequest"]) {
    const response = await fetch(`${API_PREFIX}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "same-origin",
    });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as Schemas["UserOut"];
  },
  async logout() {
    accessToken = null;
    await fetch(`${API_PREFIX}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
