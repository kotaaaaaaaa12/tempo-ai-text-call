import { buildOpenAIRequest, validateChatBody } from "./protocol.js";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetBinding;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  applySecurityHeaders(headers);
  return Response.json(data, { status, headers });
}

function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

function requestKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP")
    ?? request.headers.get("X-Client-Id")
    ?? "anonymous";
}

function isRateLimited(key: string, now = Date.now()): boolean {
  if (rateLimits.size > 5_000) {
    for (const [entryKey, value] of rateLimits) {
      if (value.resetAt <= now) rateLimits.delete(entryKey);
    }
  }

  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

async function safetyIdentifier(request: Request): Promise<string> {
  const raw = request.headers.get("X-Client-Id") ?? requestKey(request);
  const bytes = new TextEncoder().encode(raw.slice(0, 128));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function handleRespond(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }

  if (!isSameOrigin(request)) {
    return json({ error: "Cross-origin requests are not allowed." }, 403);
  }

  if (!env.OPENAI_API_KEY) {
    return json({
      error: "The server is missing OPENAI_API_KEY.",
      code: "API_NOT_CONFIGURED"
    }, 503);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  const key = requestKey(request);
  if (isRateLimited(key)) {
    return json({ error: "Too many requests. Try again in a moment." }, 429, {
      "Retry-After": "60"
    });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request body is too large." }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = validateChatBody(body);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  const model = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const upstream = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": await safetyIdentifier(request)
    },
    body: JSON.stringify(buildOpenAIRequest(parsed.value, model)),
    signal: request.signal
  });

  if (!upstream.ok || !upstream.body) {
    let message = "OpenAI could not start a response.";
    try {
      const errorBody = await upstream.json() as { error?: { message?: string } };
      if (errorBody.error?.message) message = errorBody.error.message;
    } catch {
      // Keep the safe fallback message when the upstream response is not JSON.
    }
    return json({ error: message }, upstream.status >= 400 ? upstream.status : 502);
  }

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no"
  });
  applySecurityHeaders(headers);
  return new Response(upstream.body, { status: 200, headers });
}

async function handleStatic(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);

  const pathname = new URL(request.url).pathname;
  if (pathname === "/" || pathname.endsWith(".html")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  } else if (/\.(?:js|css|webmanifest|svg)$/.test(pathname)) {
    headers.set("Cache-Control", "no-cache, must-revalidate");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/respond") {
      try {
        return await handleRespond(request, env);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return new Response(null, { status: 499 });
        }
        console.error("Response request failed", error);
        return json({ error: "The response service is temporarily unavailable." }, 502);
      }
    }

    if (url.pathname === "/api/health") {
      return json({
        ready: Boolean(env.OPENAI_API_KEY),
        model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
      });
    }

    return handleStatic(request, env);
  }
};
