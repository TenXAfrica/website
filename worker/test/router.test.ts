import { describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMIT_MAX,
  checkRateLimit,
  corsHeaders,
  isAllowedOrigin,
  isAuthorisedAdmin,
  safeEqual,
  verifyTurnstile,
} from '../src/index';
import { TwentyClient, TwentyError, escapeFilterValue } from '../src/twenty';

/**
 * Nothing here touches the network: every test that needs fetch passes its
 * own stub in. If one of these ever makes a real request, the stub count
 * assertions will catch it.
 */

const FAKE_TOKEN = 'tok_test_0000000000000000000000000000_not_real';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

describe('CORS origin allowlist', () => {
  it.each([
    'https://tenxafrica.co.za',
    'https://www.tenxafrica.co.za',
    'http://localhost:4321',
    'https://website.pages.dev',
    'https://abc123.website.pages.dev',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    'https://tenxafrica.co.za.evil.com',
    'https://evil.com',
    'http://tenxafrica.co.za',
    'https://pages.dev.evil.com',
    'https://evil.com/?x=https://tenxafrica.co.za',
    'http://localhost:3000',
    'null',
    '',
  ])('rejects %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });

  it('rejects a missing origin', () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it('echoes only an allowed origin back, and varies on it', () => {
    const headers = corsHeaders('https://tenxafrica.co.za');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://tenxafrica.co.za');
    expect(headers['Vary']).toBe('Origin');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');

    expect(corsHeaders('https://evil.com')).toEqual({});
    expect(corsHeaders(null)).toEqual({});
  });
});

/* ------------------------------------------------------------------ */
/* Admin bearer                                                        */
/* ------------------------------------------------------------------ */

describe('admin bearer gate', () => {
  const secret = 'a-long-enough-admin-token-value';

  it('accepts the exact token', () => {
    expect(isAuthorisedAdmin('Bearer ' + secret, secret)).toBe(true);
    expect(isAuthorisedAdmin('bearer ' + secret, secret)).toBe(true);
    expect(isAuthorisedAdmin('  Bearer ' + secret + '  ', secret)).toBe(true);
  });

  it.each([
    ['a wrong token', 'Bearer wrong-token-value-here-x'],
    ['a prefix of the token', 'Bearer a-long-enough-admin-token'],
    ['no scheme', 'a-long-enough-admin-token-value'],
    ['the wrong scheme', 'Basic a-long-enough-admin-token-value'],
    ['an empty header', ''],
  ])('rejects %s', (_label, header) => {
    expect(isAuthorisedAdmin(header, secret)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isAuthorisedAdmin(null, secret)).toBe(false);
  });

  it('refuses to authorise anything when the secret is unset or weak', () => {
    expect(isAuthorisedAdmin('Bearer x', '')).toBe(false);
    expect(isAuthorisedAdmin('Bearer short', 'short')).toBe(false);
  });

  it('compares in constant time on equal-length input', () => {
    expect(safeEqual('abcdef', 'abcdef')).toBe(true);
    expect(safeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Turnstile                                                           */
/* ------------------------------------------------------------------ */

describe('verifyTurnstile', () => {
  it('posts the secret, the response and the remote IP', async () => {
    const fetchStub = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get('secret')).toBe('secret-key');
      expect(form.get('response')).toBe('client-token');
      expect(form.get('remoteip')).toBe('203.0.113.7');
      return jsonResponse(200, { success: true });
    });

    const out = await verifyTurnstile(
      'client-token',
      '203.0.113.7',
      'secret-key',
      fetchStub as unknown as typeof fetch
    );

    expect(out.success).toBe(true);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(String(fetchStub.mock.calls[0]![0])).toContain(
      'challenges.cloudflare.com/turnstile/v0/siteverify'
    );
  });

  it('omits remoteip when Cloudflare gave us no IP', async () => {
    const fetchStub = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect((init?.body as FormData).get('remoteip')).toBeNull();
      return jsonResponse(200, { success: true });
    });
    await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('reports failure and the error codes', async () => {
    const fetchStub = vi.fn(async () =>
      jsonResponse(200, { success: false, 'error-codes': ['invalid-input-response'] })
    );
    const out = await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.codes).toEqual(['invalid-input-response']);
  });

  it('fails closed when the verify call itself breaks', async () => {
    const fetchStub = vi.fn(async () => {
      throw new Error('network down');
    });
    const out = await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.codes).toEqual(['verify-request-failed']);
  });

  it('fails closed when the secret is not configured', async () => {
    const fetchStub = vi.fn();
    const out = await verifyTurnstile('t', null, '', fetchStub as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, _options?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
  };
}

describe('checkRateLimit', () => {
  it('allows the first five and blocks the sixth', async () => {
    const kv = fakeKv();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const out = await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '1.2.3.4');
      expect(out.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '1.2.3.4');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('keys per IP and per bucket', async () => {
    const kv = fakeKv();
    await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '1.2.3.4');
    await checkRateLimit(kv as unknown as KVNamespace, 'contact', '1.2.3.4');
    await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '5.6.7.8');
    expect([...kv.store.keys()].sort()).toEqual([
      'rl:contact:1.2.3.4',
      'rl:selfserve:1.2.3.4',
      'rl:selfserve:5.6.7.8',
    ]);
  });

  it('sets an expiry so the window rolls off', async () => {
    const kv = fakeKv();
    await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '1.2.3.4');
    const options = kv.put.mock.calls[0]![2];
    expect(options?.expirationTtl).toBe(3600);
  });

  it('allows when the binding has not been created yet', async () => {
    const out = await checkRateLimit(undefined, 'selfserve', '1.2.3.4');
    expect(out.allowed).toBe(true);
  });

  it('allows rather than failing a lead when KV itself errors', async () => {
    const broken = {
      get: vi.fn(async () => {
        throw new Error('kv unavailable');
      }),
      put: vi.fn(),
    };
    const out = await checkRateLimit(broken as unknown as KVNamespace, 'selfserve', '1.2.3.4');
    expect(out.allowed).toBe(true);
  });

  it('ignores a corrupt counter rather than locking the IP out', async () => {
    const kv = fakeKv({ 'rl:selfserve:1.2.3.4': 'not-a-number' });
    const out = await checkRateLimit(kv as unknown as KVNamespace, 'selfserve', '1.2.3.4');
    expect(out.allowed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Twenty client transport                                             */
/* ------------------------------------------------------------------ */

describe('TwentyClient transport', () => {
  it('sends the bearer token and returns the unwrapped record', async () => {
    const fetchStub = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer ' + FAKE_TOKEN);
      return jsonResponse(201, { data: { createCompany: { id: 'c1', name: 'Acme' } } });
    });

    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    const record = await client.createCompany({ name: 'Acme' });
    expect(record?.id).toBe('c1');
    expect(String(fetchStub.mock.calls[0]![0])).toBe(
      'https://crm.tenxafrica.co.za/rest/companies'
    );
  });

  it('retries once on a 5xx and succeeds', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, { error: 'bad gateway' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { createNote: { id: 'n1' } } }));

    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    expect((await client.createNote({ title: 'x' }))?.id).toBe('n1');
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('retries once on a network failure', async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(jsonResponse(200, { data: { createTask: { id: 't1' } } }));

    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    expect((await client.createTask({ title: 'x' }))?.id).toBe('t1');
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx', async () => {
    const fetchStub = vi.fn(async () => jsonResponse(422, { messages: ['bad field'] }));
    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    await expect(client.createCompany({ name: 'x' })).rejects.toBeInstanceOf(TwentyError);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('never puts the token in the error it throws', async () => {
    // An upstream that echoes the Authorization header straight back at us is
    // the nastiest realistic case.
    const fetchStub = vi.fn(async () =>
      jsonResponse(401, { error: 'bad token: Bearer ' + FAKE_TOKEN })
    );
    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    await expect(client.createCompany({ name: 'x' })).rejects.toThrow();
    try {
      await client.createCompany({ name: 'x' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const text = String((err as Error).message) + JSON.stringify(err);
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).toContain('[redacted]');
    }
  });

  it('gives up after the retry and reports the status without the body verbatim', async () => {
    const fetchStub = vi.fn(async () => jsonResponse(503, { error: 'unavailable' }));
    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    await expect(client.createCompany({ name: 'x' })).rejects.toThrow(/503/);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('aborts a call that outruns the timeout', async () => {
    const fetchStub = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
      timeoutMs: 10,
    });

    await expect(client.createCompany({ name: 'x' })).rejects.toBeInstanceOf(TwentyError);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('honours a custom base URL and builds the filter query', async () => {
    const fetchStub = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      jsonResponse(200, { data: { companies: [] } })
    );
    const client = new TwentyClient({
      baseUrl: 'https://crm.example.test/',
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    await client.findCompanyByName('Acme Widgets');
    const url = new URL(String(fetchStub.mock.calls[0]![0]));
    expect(url.origin).toBe('https://crm.example.test');
    expect(url.pathname).toBe('/rest/companies');
    expect(url.searchParams.get('filter')).toBe('name[eq]:"Acme Widgets"');
    expect(url.searchParams.get('limit')).toBe('1');
  });

  it('returns null from a lookup that matched nothing', async () => {
    const fetchStub = vi.fn(async () => jsonResponse(200, { data: { people: [] } }));
    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    expect(await client.findPersonByEmail('nobody@example.com')).toBeNull();
  });

  it('strips characters that would break out of a quoted filter term', () => {
    expect(escapeFilterValue('Acme "Widgets", (Pty) Ltd')).toBe('Acme Widgets Pty Ltd');
    expect(escapeFilterValue('  spaced  ')).toBe('spaced');
  });
});
