/**
 * The guided tool's connection to the internal API.
 *
 * On tenxafrica.co.za the API is same-origin under /api/internal, behind the
 * same Cloudflare Access sign-in as the page, so the browser sends the Access
 * cookie and nobody types a password. Anywhere else (local dev, the review
 * preview) the calls go to the Worker's own hostname and need the admin token,
 * which the tool then asks for once.
 */

import type { LookupResult, SessionRequest, SessionResponse } from '../../../../worker/src/lookup';
import type { FullSubmission, ScoreResult } from '../../../../shared/dma/types';
import { DMA_WORKER_URL } from '../util';

export type { LookupCompany, LookupResult, SessionRequest, SessionResponse } from '../../../../worker/src/lookup';

export interface Identity {
  email: string | null;
  name: string | null;
  via: 'access' | 'token';
}

export function isProductionHost(): boolean {
  if (typeof window === 'undefined') return false;
  return /(^|\.)tenxafrica\.co\.za$/i.test(window.location.hostname);
}

/** '' means same-origin. */
export function internalApiBase(): string {
  return isProductionHost() ? '' : DMA_WORKER_URL;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: string[];
  constructor(status: number, code: string, details?: string[]) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
}

async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  const base = internalApiBase();
  if (base === '' && !isProductionHost()) {
    throw new ApiError(0, 'no_worker_url');
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    const res = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: controller.signal,
    });
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) {
      const p = (payload ?? {}) as { error?: string; details?: string[] };
      throw new ApiError(res.status, p.error ?? `http_${res.status}`, p.details);
    }
    return payload as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError(0, 'timeout');
    throw new ApiError(0, 'network');
  } finally {
    window.clearTimeout(timer);
  }
}

export function whoami(token?: string): Promise<Identity & { ok: true }> {
  return call('/api/internal/whoami', { token });
}

export function lookup(query: string, token?: string): Promise<LookupResult> {
  return call(`/api/internal/dma/lookup?q=${encodeURIComponent(query)}`, { token });
}

export function createSession(input: SessionRequest, token?: string): Promise<SessionResponse> {
  return call('/api/internal/dma/session', { method: 'POST', body: input, token });
}

export function submitFull(
  submission: FullSubmission,
  token?: string
): Promise<{ ok: true; result: ScoreResult }> {
  return call('/api/internal/dma/full', { method: 'POST', body: submission, token, timeoutMs: 30_000 });
}

/**
 * The display name Cloudflare Access knows for the signed-in person. Same
 * origin only; on any other host this quietly returns null.
 */
export async function accessDisplayName(): Promise<{ name: string | null; email: string | null } | null> {
  if (!isProductionHost()) return null;
  try {
    const res = await fetch('/cdn-cgi/access/get-identity', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; email?: string };
    return { name: data.name ?? null, email: data.email ?? null };
  } catch {
    return null;
  }
}

/** Plain-English explanation of an API failure, for the status line. */
export function explainApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Nothing was lost.';
  switch (err.code) {
    case 'no_worker_url':
      return 'This build has no API address, so nothing can be looked up or saved. Use Copy report or Download JSON.';
    case 'unauthorised':
      return isProductionHost()
        ? 'Your sign-in was not accepted. Reload the page to sign in again with your Ten X Africa Microsoft account.'
        : 'Not signed in. On this address the tool needs the API token: paste it under "Not signed in?".';
    case 'timeout':
      return 'The CRM took too long to answer. Try again in a moment.';
    case 'network':
      return 'Could not reach the CRM service. Check the connection and try again.';
    case 'query_too_short':
      return 'Type at least two characters.';
    case 'company_not_found':
      return 'That company no longer exists in the CRM. Search again.';
    case 'opportunity_not_found':
      return 'That opportunity no longer exists in the CRM. Choose another or create a new one.';
    case 'invalid_submission':
      return 'The CRM rejected the assessment: ' + (err.details ?? []).slice(0, 3).join('; ');
    default:
      return `The CRM service answered with an error (${err.code}). Nothing was lost.`;
  }
}
