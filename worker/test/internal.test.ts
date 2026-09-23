import { describe, expect, it } from 'vitest';
import { clearAccessCertCache, verifyAccessJwt } from '../src/access';
import { extractDomain, summariseNotes, validateSession } from '../src/lookup';

/* ------------------------------------------------------------------ */
/* Access JWT                                                          */
/* ------------------------------------------------------------------ */

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makeSigner() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  const kid = 'test-kid-1';
  const sign = async (payload: Record<string, unknown>, header: Record<string, unknown> = {}) => {
    const h = b64url(JSON.stringify({ alg: 'RS256', kid, ...header }));
    const p = b64url(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
    return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
  };
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
  return { sign, fetchImpl };
}

const TEAM = 'tenxafrica.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const NOW = 1_800_000_000_000;

describe('verifyAccessJwt', () => {
  it('accepts a well-formed token for the right application', async () => {
    clearAccessCertCache();
    const { sign, fetchImpl } = await makeSigner();
    const token = await sign({
      aud: [AUD],
      iss: `https://${TEAM}`,
      exp: NOW / 1000 + 600,
      email: 'Someone@TenXAfrica.co.za',
      sub: 'abc',
    });
    const who = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW });
    expect(who).toEqual({ email: 'someone@tenxafrica.co.za', sub: 'abc' });
  });

  it('rejects an expired token', async () => {
    clearAccessCertCache();
    const { sign, fetchImpl } = await makeSigner();
    const token = await sign({ aud: [AUD], iss: `https://${TEAM}`, exp: NOW / 1000 - 600, email: 'x@tenxafrica.co.za' });
    expect(await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW })).toBeNull();
  });

  it('rejects a token for another application or issuer', async () => {
    clearAccessCertCache();
    const { sign, fetchImpl } = await makeSigner();
    const wrongAud = await sign({ aud: ['b'.repeat(64)], iss: `https://${TEAM}`, exp: NOW / 1000 + 600, email: 'x@tenxafrica.co.za' });
    expect(await verifyAccessJwt(wrongAud, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW })).toBeNull();
    const wrongIss = await sign({ aud: [AUD], iss: 'https://evil.cloudflareaccess.com', exp: NOW / 1000 + 600, email: 'x@tenxafrica.co.za' });
    expect(await verifyAccessJwt(wrongIss, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW })).toBeNull();
  });

  it('rejects a tampered payload and the "none" algorithm', async () => {
    clearAccessCertCache();
    const { sign, fetchImpl } = await makeSigner();
    const good = await sign({ aud: [AUD], iss: `https://${TEAM}`, exp: NOW / 1000 + 600, email: 'x@tenxafrica.co.za' });
    const [h, , s] = good.split('.') as [string, string, string];
    const forgedPayload = b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, exp: NOW / 1000 + 600, email: 'attacker@evil.com' }));
    expect(await verifyAccessJwt(`${h}.${forgedPayload}.${s}`, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW })).toBeNull();

    const none = `${b64url(JSON.stringify({ alg: 'none', kid: 'test-kid-1' }))}.${forgedPayload}.`;
    expect(await verifyAccessJwt(none, { teamDomain: TEAM, aud: AUD, fetchImpl, now: () => NOW })).toBeNull();
  });

  it('treats garbage and missing tokens as anonymous', async () => {
    expect(await verifyAccessJwt(null, { teamDomain: TEAM, aud: AUD })).toBeNull();
    expect(await verifyAccessJwt('not.a.jwt.at.all', { teamDomain: TEAM, aud: AUD })).toBeNull();
    expect(await verifyAccessJwt('a.b', { teamDomain: TEAM, aud: AUD })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                      */
/* ------------------------------------------------------------------ */

describe('extractDomain', () => {
  it.each([
    ['acme.com', 'acme.com'],
    ['https://www.acme.co.uk/about', 'acme.co.uk'],
    ['jane@acme.com', 'acme.com'],
    ['Acme Plumbing', ''],
    ['acme', ''],
  ])('%s -> %s', (input, expected) => {
    expect(extractDomain(input)).toBe(expected);
  });
});

describe('summariseNotes', () => {
  it('finds the newest self-serve score and guided assessment', () => {
    const out = summariseNotes([
      { id: '1', title: 'DMA self-serve score: Acme (41/100)', createdAt: '2026-09-01T00:00:00Z' },
      { id: '2', title: 'DMA self-serve score: Acme (62/100)', createdAt: '2026-09-10T00:00:00Z' },
      { id: '3', title: 'DMA (full): Acme', createdAt: '2026-09-12T00:00:00Z' },
      { id: '4', title: 'Enrichment: Acme', createdAt: '2026-09-13T00:00:00Z' },
    ]);
    expect(out.selfServe).toEqual({ score: 62, date: '2026-09-10T00:00:00Z', noteId: '2' });
    expect(out.guided).toEqual({ date: '2026-09-12T00:00:00Z', noteId: '3' });
    expect(out.noteTitles[0]).toBe('Enrichment: Acme');
  });

  it('is empty for a company with no notes', () => {
    expect(summariseNotes([])).toEqual({ selfServe: null, guided: null, noteTitles: [] });
  });
});

describe('validateSession', () => {
  it('requires a company name and a valid email when given', () => {
    expect(validateSession({})).toEqual({ ok: false, errors: ['companyName is required'] });
    expect(validateSession({ companyName: 'Acme', contactEmail: 'nope' })).toEqual({
      ok: false,
      errors: ['contactEmail is not valid'],
    });
  });

  it('trims, lowercases the email and drops empty optionals', () => {
    const v = validateSession({
      companyName: '  Acme  ',
      website: '',
      contactEmail: ' Jane@Acme.com ',
      opportunityId: '',
    });
    expect(v).toEqual({ ok: true, value: { companyName: 'Acme', contactEmail: 'jane@acme.com' } });
  });
});
