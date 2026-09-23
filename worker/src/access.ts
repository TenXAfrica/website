/**
 * Cloudflare Access identity for the internal endpoints.
 *
 * The guided assessment tool lives at tenxafrica.co.za/internal/dma behind a
 * Cloudflare Access application (Microsoft 365 sign-in, any @tenxafrica.co.za
 * account). Its API lives under /api/internal on the same host, inside the
 * same Access application, so the browser's Access cookie is sent with every
 * request and Access adds a signed JWT in `Cf-Access-Jwt-Assertion`.
 *
 * This module verifies that JWT: RS256 signature against the team's public
 * keys, audience equal to the application's AUD tag, issuer equal to the team
 * domain, not expired. On success the caller learns WHO is using the tool,
 * which is what the shared "paste the token" model could never say.
 *
 * Nothing here trusts a header by itself. A request that merely carries the
 * header but fails verification is treated as anonymous.
 */

export interface AccessIdentity {
  email: string;
  /** Best-effort display name from the token, when Access included one. */
  name?: string;
  /** Token subject, stable per user. */
  sub?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
  use?: string;
}

interface CertsResponse {
  keys?: Jwk[];
}

const CERTS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

interface CertCache {
  team: string;
  keys: Map<string, Jwk>;
  fetchedAt: number;
}

let cache: CertCache | null = null;

/** Test seam. */
export function clearAccessCertCache(): void {
  cache = null;
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    const text = new TextDecoder().decode(b64urlToBytes(segment));
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function loadKeys(
  team: string,
  fetchImpl: typeof fetch,
  force = false
): Promise<Map<string, Jwk>> {
  const now = Date.now();
  if (!force && cache && cache.team === team && now - cache.fetchedAt < CERTS_TTL_MS) {
    return cache.keys;
  }
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('access-certs-' + res.status);
  const body = (await res.json()) as CertsResponse;
  const keys = new Map<string, Jwk>();
  for (const k of body.keys ?? []) {
    if (k && typeof k.kid === 'string' && k.kty === 'RSA') keys.set(k.kid, k);
  }
  cache = { team, keys, fetchedAt: now };
  return keys;
}

export interface VerifyOptions {
  /** e.g. "tenxafrica.cloudflareaccess.com" */
  teamDomain: string;
  /** The Access application's AUD tag. */
  aud: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Verify an Access application token. Returns the identity, or null for any
 * failure. Never throws: an unverifiable token is simply "not signed in".
 */
export async function verifyAccessJwt(
  token: string | null | undefined,
  options: VerifyOptions
): Promise<AccessIdentity | null> {
  if (!token || !options.teamDomain || !options.aud) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];

  const header = decodeJson(h);
  const payload = decodeJson(p);
  if (!header || !payload) return null;
  if (header['alg'] !== 'RS256' || typeof header['kid'] !== 'string') return null;

  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const exp = payload['exp'];
  if (typeof exp !== 'number' || exp + CLOCK_SKEW_SECONDS < nowSeconds) return null;
  const nbf = payload['nbf'];
  if (typeof nbf === 'number' && nbf - CLOCK_SKEW_SECONDS > nowSeconds) return null;

  if (payload['iss'] !== `https://${options.teamDomain}`) return null;

  const aud = payload['aud'];
  const audList = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
  if (!audList.includes(options.aud)) return null;

  const email = payload['email'];
  if (typeof email !== 'string' || !email.includes('@')) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    let keys = await loadKeys(options.teamDomain, fetchImpl);
    let jwk = keys.get(header['kid']);
    if (!jwk) {
      // Key rotation: refresh once, then give up.
      keys = await loadKeys(options.teamDomain, fetchImpl, true);
      jwk = keys.get(header['kid']);
    }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
  } catch {
    return null;
  }

  const identity: AccessIdentity = { email: email.toLowerCase() };
  const name = payload['name'];
  if (typeof name === 'string' && name.trim()) identity.name = name.trim();
  const sub = payload['sub'];
  if (typeof sub === 'string') identity.sub = sub;
  return identity;
}

export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion';
