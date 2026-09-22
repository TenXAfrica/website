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
  /**
   * Plain var. Comma-separated exact origins to allow in addition to the
   * built-in list, e.g. a named Cloudflare Pages preview. Exact origins only:
   * there is deliberately no wildcard.
   */
  ALLOWED_PREVIEW_ORIGINS?: string;
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

/**
 * Hostnames Turnstile is allowed to have been solved on.
 *
 * siteverify echoes back the hostname of the page that solved the challenge.
 * Without checking it, a token farmed from a challenge on someone else's site
 * using our sitekey would verify here.
 */
const TURNSTILE_HOSTS = new Set(['tenxafrica.co.za', 'www.tenxafrica.co.za', 'localhost']);

/**
 * Extra origins from a plain var, comma-separated.
 *
 * There is deliberately no `*.pages.dev` wildcard. Anyone can register a
 * pages.dev subdomain, so that pattern is not an allowlist -- it is the whole
 * internet. The site deploys to GitHub Pages and does not need it. If a
 * Cloudflare Pages preview is ever wanted, name that exact origin in the
 * ALLOWED_PREVIEW_ORIGINS var instead.
 */
export function extraOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 256 && /^https?:\/\//.test(s));
}

export function isAllowedOrigin(origin: string | null, extra: string[] = []): boolean {
  if (!origin) return false;
  if (EXACT_ORIGINS.has(origin)) return true;
  return extra.includes(origin);
}

export function corsHeaders(
  origin: string | null,
  extra: string[] = []
): Record<string, string> {
  if (!isAllowedOrigin(origin, extra) || !origin) return {};
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
  allowedExtra: string[] = [],
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...corsHeaders(origin, allowedExtra),
      ...extraHeaders,
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
  fetchImpl: typeof fetch = fetch,
  allowedHosts: ReadonlySet<string> = TURNSTILE_HOSTS
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
      hostname?: string;
      'error-codes'?: string[];
    };
    const codes = Array.isArray(body['error-codes']) ? body['error-codes'] : [];

    if (body.success !== true) {
      return { success: false, codes };
    }

    // A valid token is not enough: it must have been solved on one of our
    // pages. Otherwise a challenge hosted elsewhere under our sitekey mints
    // tokens that pass here.
    const hostname = typeof body.hostname === 'string' ? body.hostname.toLowerCase() : '';
    if (!allowedHosts.has(hostname)) {
      logEvent('warn', 'turnstile-hostname-mismatch', { hostname });
      return { success: false, codes: [...codes, 'hostname-not-allowed'] };
    }

    return { success: true, codes };
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

/**
 * Compare two strings without leaking *where* they differ.
 *
 * The early return on unequal lengths does leak the length, which the
 * previous comment here wrongly claimed it did not. That is fine and standard:
 * the comparison is constant-time with respect to the token's content, which
 * is the part an attacker would otherwise probe byte by byte. Length alone
 * does not narrow a high-entropy secret usefully.
 */
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

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  // Content-Length must be present and parseable. Without this a chunked POST
  // carries no length at all and walks straight past the cap into
  // request.text(), which is an unbounded read.
  const header = request.headers.get('content-length');
  if (header === null || !/^\d+$/.test(header.trim())) {
    return { ok: false, status: 411, error: 'length_required' };
  }

  const declared = Number.parseInt(header.trim(), 10);
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch {
    return { ok: false, status: 400, error: 'unreadable_body' };
  }

  // Measured in bytes, not UTF-16 units: `text.length` undercounts every
  // non-BMP character, so a body of emoji could be twice the declared cap.
  // This also catches a body that disagrees with its own Content-Length.
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buffer);
  } catch {
    return { ok: false, status: 400, error: 'invalid_encoding' };
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
    const allowedExtra = extraOrigins(env.ALLOWED_PREVIEW_ORIGINS);

    // Everything logged from here on is scrubbed of these values.
    registerSecret(env.TWENTY_API_KEY);
    registerSecret(env.TURNSTILE_SECRET_KEY);
    registerSecret(env.DMA_ADMIN_TOKEN);

    /* --- preflight --- */
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, allowedExtra)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowedExtra) });
    }

    /* --- health, before anything that can fail --- */
    if (path === '/api/dma/health') {
      if (request.method !== 'GET') {
        return json(405, { ok: false, error: 'method_not_allowed' }, origin, allowedExtra);
      }
      return json(200, { ok: true, version }, origin, allowedExtra);
    }

    // A browser request must come from an origin we know. Server-to-server
    // callers (curl, Joash's internal tool) send no Origin at all, which is
    // fine -- they are gated on the admin bearer instead.
    if (origin !== null && !isAllowedOrigin(origin, allowedExtra)) {
      logEvent('warn', 'origin-rejected', { origin });
      return new Response(JSON.stringify({ ok: false, error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed' }, origin, allowedExtra);
    }

    const ip = request.headers.get('CF-Connecting-IP');

    try {
      /* ---------------------- internal: full DMA ---------------------- */
      if (path === '/api/dma/full') {
        if (!isAuthorisedAdmin(request.headers.get('Authorization'), env.DMA_ADMIN_TOKEN)) {
          logEvent('warn', 'full-dma-unauthorised');
          return json(401, { ok: false, error: 'unauthorised' }, origin, allowedExtra);
        }

        const body = await readJsonBody(request);
        if (!body.ok) return json(body.status, { ok: false, error: body.error }, origin, allowedExtra);

        const result = await handleFull(body.value, {
          twenty: twentyFor(env),
          version,
        });
        return json(result.status, result.body, origin, allowedExtra);
      }

      /* ----------------------- public endpoints ----------------------- */
      const isSelfServe = path === '/api/dma/self-serve';
      const isContact = path === '/api/contact';
      if (!isSelfServe && !isContact) {
        return json(404, { ok: false, error: 'not_found' }, origin, allowedExtra);
      }

      const bucket = isSelfServe ? 'selfserve' : 'contact';
      const limit = await checkRateLimit(env.DMA_RATELIMIT, bucket, ip);
      if (!limit.allowed) {
        logEvent('warn', 'ratelimited', { bucket });
        return json(429, { ok: false, error: 'rate_limited' }, origin, allowedExtra, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }

      const body = await readJsonBody(request);
      if (!body.ok) return json(body.status, { ok: false, error: body.error }, origin, allowedExtra);

      const token =
        typeof body.value === 'object' && body.value !== null
          ? (body.value as { turnstileToken?: unknown }).turnstileToken
          : undefined;

      if (typeof token !== 'string' || token.length === 0) {
        return json(400, { ok: false, error: 'turnstile_missing' }, origin, allowedExtra);
      }

      const turnstile = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
      if (!turnstile.success) {
        logEvent('warn', 'turnstile-rejected', { codes: turnstile.codes, bucket });
        return json(400, { ok: false, error: 'turnstile_failed' }, origin, allowedExtra);
      }

      const deps = { twenty: twentyFor(env), version };
      const result = isSelfServe
        ? await handleSelfServe(body.value, deps)
        : await handleContact(body.value, deps);

      return json(result.status, result.body, origin, allowedExtra);
    } catch (err) {
      // Anything that reaches here is a bug. Log it redacted, tell the
      // browser nothing.
      logEvent('error', 'unhandled', err);
      return json(500, { ok: false, error: 'internal_error' }, origin, allowedExtra);
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
