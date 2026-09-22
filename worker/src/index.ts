/**
 * Ten X Africa -- Digital Maturity Assessment intake Worker.
 *
 * Routes:
 *   POST /api/dma/self-serve  public, Turnstile + per-IP rate limit
 *   POST /api/dma/full        internal, Bearer DMA_ADMIN_TOKEN
 *   POST /api/contact         public, Turnstile + per-IP rate limit
 *   GET  /api/dma/health      public, no secrets in the response
 *
 * The one rule that outranks everything else here: never lose a lead. A
 * missing KV binding, a slow CRM, a failed note target -- all of those log
 * and carry on. Only a failed Turnstile check or a malformed payload is
 * allowed to reject a submission.
 */

import { handleContact, handleSelfServe } from './selfserve';
import { handleFull } from './full';
import {
  DEFAULT_TWENTY_BASE_URL,
  TwentyClient,
  logEvent,
  redact,
  registerSecret,
} from './twenty';

export interface Env {
  /** Secret. Pushed with scripts/push-worker-secret.ps1. */
  TWENTY_API_KEY: string;
  /** Secret. Cloudflare Turnstile server-side key. */
  TURNSTILE_SECRET_KEY: string;
  /** Secret. Shared bearer for the internal full-DMA endpoint. */
  DMA_ADMIN_TOKEN: string;
  /** Plain var. */
  TWENTY_BASE_URL?: string;
  /** Plain var. Echoed by /health. */
  WORKER_VERSION?: string;
  /** Optional until Joash creates the namespace. Absent means "allow". */
  DMA_RATELIMIT?: KVNamespace;
}

const FALLBACK_VERSION = 'dma-worker-0.1.0';

/** 64 KB is generous for the biggest full-DMA payload and cheap to enforce. */
const MAX_BODY_BYTES = 64 * 1024;

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 8_000;

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

const EXACT_ORIGINS = new Set([
  'https://tenxafrica.co.za',
  'https://www.tenxafrica.co.za',
  'http://localhost:4321',
]);

/** Cloudflare Pages preview deployments, e.g. https://abc123.website.pages.dev */
const PAGES_PREVIEW_RE = /^https:\/\/[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*\.pages\.dev$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (EXACT_ORIGINS.has(origin)) return true;
  return PAGES_PREVIEW_RE.test(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin) || !origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  status: number,
  body: unknown,
  origin: string | null,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Turnstile                                                           */
/* ------------------------------------------------------------------ */

export interface TurnstileOutcome {
  success: boolean;
  codes: string[];
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secret: string,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileOutcome> {
  if (!secret) {
    // Refusing to fail open: an unconfigured Turnstile secret is a
    // misconfiguration, not a reason to accept unverified public input.
    logEvent('error', 'turnstile-secret-missing');
    return { success: false, codes: ['secret-not-configured'] };
  }

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const body = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };
    return {
      success: body.success === true,
      codes: Array.isArray(body['error-codes']) ? body['error-codes'] : [],
    };
  } catch (err) {
    logEvent('warn', 'turnstile-verify-failed', err);
    return { success: false, codes: ['verify-request-failed'] };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * Per-IP counter in KV, best effort.
 *
 * KV has no atomic increment, so a burst of simultaneous requests can slip
 * past the cap. That is the right trade here: this exists to blunt a script,
 * not to be a ledger. If the binding is missing entirely we log once and
 * allow -- never fail a lead on infrastructure that has not been created yet.
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  bucket: string,
  ip: string | null,
  max: number = RATE_LIMIT_MAX
): Promise<{ allowed: boolean; remaining: number }> {
  if (!kv) {
    logEvent('warn', 'ratelimit-binding-missing', { bucket });
    return { allowed: true, remaining: max };
  }
  if (!ip) return { allowed: true, remaining: max };

  const key = 'rl:' + bucket + ':' + ip;
  try {
    const raw = await kv.get(key);
    const count = raw ? Number.parseInt(raw, 10) : 0;
    const current = Number.isFinite(count) && count > 0 ? count : 0;

    if (current >= max) {
      return { allowed: false, remaining: 0 };
    }

    await kv.put(key, String(current + 1), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    });
    return { allowed: true, remaining: max - current - 1 };
  } catch (err) {
    logEvent('warn', 'ratelimit-failed-open', err);
    return { allowed: true, remaining: max };
  }
}

/* ------------------------------------------------------------------ */
/* Admin bearer                                                        */
/* ------------------------------------------------------------------ */

/** Constant-time string compare, so a wrong token leaks no length signal. */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] as number) ^ (bBytes[i] as number);
  }
  return diff === 0;
}

export function isAuthorisedAdmin(header: string | null, expected: string): boolean {
  if (!expected || expected.length < 16) {
    logEvent('error', 'admin-token-missing-or-weak');
    return false;
  }
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return safeEqual(match[1] as string, expected);
}

/* ------------------------------------------------------------------ */
/* Body reading                                                        */
/* ------------------------------------------------------------------ */

async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'unreadable_body' };
  }

  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' };
  }
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const version = env.WORKER_VERSION || FALLBACK_VERSION;

    // Everything logged from here on is scrubbed of these values.
    registerSecret(env.TWENTY_API_KEY);
    registerSecret(env.TURNSTILE_SECRET_KEY);
    registerSecret(env.DMA_ADMIN_TOKEN);

    /* --- preflight --- */
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    /* --- health, before anything that can fail --- */
    if (path === '/api/dma/health') {
      if (request.method !== 'GET') {
        return json(405, { ok: false, error: 'method_not_allowed' }, origin);
      }
      return json(200, { ok: true, version }, origin);
    }

    // A browser request must come from an origin we know. Server-to-server
    // callers (curl, Joash's internal tool) send no Origin at all, which is
    // fine -- they are gated on the admin bearer instead.
    if (origin !== null && !isAllowedOrigin(origin)) {
      logEvent('warn', 'origin-rejected', { origin });
      return new Response(JSON.stringify({ ok: false, error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed' }, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP');

    try {
      /* ---------------------- internal: full DMA ---------------------- */
      if (path === '/api/dma/full') {
        if (!isAuthorisedAdmin(request.headers.get('Authorization'), env.DMA_ADMIN_TOKEN)) {
          logEvent('warn', 'full-dma-unauthorised');
          return json(401, { ok: false, error: 'unauthorised' }, origin);
        }

        const body = await readJsonBody(request);
        if (!body.ok) return json(body.status, { ok: false, error: body.error }, origin);

        const result = await handleFull(body.value, {
          twenty: twentyFor(env),
          version,
        });
        return json(result.status, result.body, origin);
      }

      /* ----------------------- public endpoints ----------------------- */
      const isSelfServe = path === '/api/dma/self-serve';
      const isContact = path === '/api/contact';
      if (!isSelfServe && !isContact) {
        return json(404, { ok: false, error: 'not_found' }, origin);
      }

      const bucket = isSelfServe ? 'selfserve' : 'contact';
      const limit = await checkRateLimit(env.DMA_RATELIMIT, bucket, ip);
      if (!limit.allowed) {
        logEvent('warn', 'ratelimited', { bucket });
        return json(429, { ok: false, error: 'rate_limited' }, origin, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }

      const body = await readJsonBody(request);
      if (!body.ok) return json(body.status, { ok: false, error: body.error }, origin);

      const token =
        typeof body.value === 'object' && body.value !== null
          ? (body.value as { turnstileToken?: unknown }).turnstileToken
          : undefined;

      if (typeof token !== 'string' || token.length === 0) {
        return json(400, { ok: false, error: 'turnstile_missing' }, origin);
      }

      const turnstile = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
      if (!turnstile.success) {
        logEvent('warn', 'turnstile-rejected', { codes: turnstile.codes, bucket });
        return json(400, { ok: false, error: 'turnstile_failed' }, origin);
      }

      const deps = { twenty: twentyFor(env), version };
      const result = isSelfServe
        ? await handleSelfServe(body.value, deps)
        : await handleContact(body.value, deps);

      return json(result.status, result.body, origin);
    } catch (err) {
      // Anything that reaches here is a bug. Log it redacted, tell the
      // browser nothing.
      logEvent('error', 'unhandled', err);
      return json(500, { ok: false, error: 'internal_error' }, origin);
    }
  },
} satisfies ExportedHandler<Env>;

function twentyFor(env: Env): TwentyClient {
  if (!env.TWENTY_API_KEY) {
    logEvent('error', 'twenty-api-key-missing');
  }
  return new TwentyClient({
    baseUrl: env.TWENTY_BASE_URL || DEFAULT_TWENTY_BASE_URL,
    apiKey: env.TWENTY_API_KEY ?? '',
  });
}

// Re-exported so the tests can exercise the redactor through the same entry
// point the Worker uses.
export { redact };
