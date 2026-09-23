import { describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_MAX } from '../src/limits';
import {
  checkRateLimit,
  corsHeaders,
  extraOrigins,
  isAllowedOrigin,
  isAuthorisedAdmin,
  readJsonBody,
  safeEqual,
  verifyTurnstile,
} from '../src/index';
import {
  TwentyClient,
  TwentyError,
  escapeFilterValue,
  isFilterSafe,
} from '../src/twenty';

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

  /**
   * pages.dev is open registration, so a wildcard over it is not an
   * allowlist -- anyone can claim a subdomain and be trusted.
   */
  it.each([
    'https://website.pages.dev',
    'https://abc123.website.pages.dev',
    'https://tenxafrica-attacker.pages.dev',
  ])('no longer trusts %s by wildcard', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });

  it('allows a preview origin only when it is named exactly in the var', () => {
    const extra = extraOrigins('https://preview.website.pages.dev');
    expect(isAllowedOrigin('https://preview.website.pages.dev', extra)).toBe(true);
    // A sibling on the same open-registration suffix stays out.
    expect(isAllowedOrigin('https://other.website.pages.dev', extra)).toBe(false);
  });

  it('parses the preview origin var defensively', () => {
    expect(extraOrigins(undefined)).toEqual([]);
    expect(extraOrigins('')).toEqual([]);
    expect(extraOrigins('  ')).toEqual([]);
    expect(extraOrigins('https://a.test, https://b.test')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    // Anything that is not an http(s) origin is dropped rather than trusted.
    expect(extraOrigins('javascript:alert(1),*,https://ok.test')).toEqual(['https://ok.test']);
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
      return jsonResponse(200, { success: true, hostname: 'tenxafrica.co.za' });
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
      return jsonResponse(200, { success: true, hostname: 'tenxafrica.co.za' });
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

  /**
   * siteverify says the token is valid AND where it was solved. Without the
   * hostname check, a challenge hosted on an attacker's page under our
   * sitekey mints tokens that pass here.
   */
  it('rejects a valid token solved on somebody else site', async () => {
    const fetchStub = vi.fn(async () =>
      jsonResponse(200, { success: true, hostname: 'phishing-tenxafrica.example' })
    );
    const out = await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.codes).toContain('hostname-not-allowed');
  });

  it('rejects a success response with no hostname at all', async () => {
    const fetchStub = vi.fn(async () => jsonResponse(200, { success: true }));
    const out = await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.codes).toContain('hostname-not-allowed');
  });

  it.each(['tenxafrica.co.za', 'www.tenxafrica.co.za', 'localhost'])(
    'accepts a token solved on %s',
    async (hostname) => {
      const fetchStub = vi.fn(async () => jsonResponse(200, { success: true, hostname }));
      const out = await verifyTurnstile('t', null, 's', fetchStub as unknown as typeof fetch);
      expect(out.success).toBe(true);
    }
  );

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
/* Body reading                                                        */
/* ------------------------------------------------------------------ */

function postWith(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request('https://worker.test/api/dma/self-serve', {
    method: 'POST',
    body,
    headers,
  });
}

describe('readJsonBody', () => {
  it('reads a well-formed body', async () => {
    const payload = JSON.stringify({ hello: 'world' });
    const out = await readJsonBody(
      postWith(payload, { 'content-length': String(payload.length) })
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toEqual({ hello: 'world' });
  });

  /**
   * The gap this closes: a chunked POST carries no Content-Length, so the
   * old check was skipped entirely and request.text() became an unbounded
   * read.
   */
  it('refuses a request with no Content-Length', async () => {
    const request = postWith('{"a":1}');
    request.headers.delete('content-length');
    const out = await readJsonBody(request);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(411);
      expect(out.error).toBe('length_required');
    }
  });

  it.each(['abc', '12abc', '-1', '1e6', ' '])(
    'refuses an unparseable Content-Length (%s)',
    async (value) => {
      const out = await readJsonBody(postWith('{"a":1}', { 'content-length': value }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.status).toBe(411);
    }
  );

  it('refuses a declared length over the cap without reading the body', async () => {
    const out = await readJsonBody(
      postWith('{"a":1}', { 'content-length': String(64 * 1024 + 1) })
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(413);
  });

  /**
   * text.length counts UTF-16 units, so a body of astral-plane characters
   * measured that way undercounts its real byte size by up to 4x.
   */
  it('measures bytes rather than UTF-16 units', async () => {
    // 20k x U+1F600 is 40k UTF-16 units but 80k bytes.
    const emoji = '\u{1F600}'.repeat(20_000);
    const payload = JSON.stringify({ m: emoji });
    const bytes = new TextEncoder().encode(payload).byteLength;

    expect(payload.length).toBeLessThan(64 * 1024);
    expect(bytes).toBeGreaterThan(64 * 1024);

    const out = await readJsonBody(postWith(payload, { 'content-length': String(bytes) }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(413);
  });

  it('rejects a body that lies about its own length', async () => {
    const big = JSON.stringify({ m: 'x'.repeat(70_000) });
    const out = await readJsonBody(postWith(big, { 'content-length': '10' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(413);
  });

  it('rejects malformed json and malformed utf-8', async () => {
    const bad = await readJsonBody(postWith('{nope', { 'content-length': '5' }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('invalid_json');

    const invalidUtf8 = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    const out = await readJsonBody(
      postWith(invalidUtf8, { 'content-length': String(invalidUtf8.byteLength) })
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('invalid_encoding');
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

  it('strips only the characters that could terminate a quoted filter term', () => {
    // Verified against the live CRM: commas, parens and ampersands match
    // correctly as-is, and escaping them breaks matching. Only " and \ are
    // touched.
    expect(escapeFilterValue('Acme "Widgets"')).toBe('Acme Widgets');
    expect(escapeFilterValue('Acme, Inc')).toBe('Acme, Inc');
    expect(escapeFilterValue('Acme (Pty) Ltd')).toBe('Acme (Pty) Ltd');
    expect(escapeFilterValue('Smith & Sons, (Pty) Ltd')).toBe('Smith & Sons, (Pty) Ltd');
    expect(escapeFilterValue('  spaced  ')).toBe('spaced');
  });

  it('knows when a lookup would be lossy', () => {
    expect(isFilterSafe('Acme, Inc')).toBe(true);
    expect(isFilterSafe('Acme (Pty) Ltd')).toBe(true);
    expect(isFilterSafe('Acme "Widgets"')).toBe(false);
    expect(isFilterSafe('Acme\\Widgets')).toBe(false);
    expect(isFilterSafe('   ')).toBe(false);
  });

  it('skips a lookup it cannot ask faithfully rather than matching the wrong record', async () => {
    const fetchStub = vi.fn();
    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    // Stripping the quotes would ask about a company literally named
    // `Acme Widgets`, which could be someone else entirely.
    expect(await client.findCompanyByName('Acme "Widgets"')).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  /**
   * The bug this pins: the write path stores the raw name, so a lookup that
   * altered punctuation could never match what was just written, and
   * "Acme, Inc" created a duplicate Company on every resubmission.
   */
  it('round-trips a punctuated company name between create and lookup', async () => {
    const stored: Array<{ id: string; name: string }> = [];

    const fetchStub = vi.fn(async (url: unknown, init?: RequestInit) => {
      const target = new URL(String(url));

      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        const record = { id: 'c' + (stored.length + 1), name: body.name };
        stored.push(record);
        return jsonResponse(201, { data: { createCompany: record } });
      }

      // Answer the filter the way Twenty does: exact match on the raw value.
      const filter = target.searchParams.get('filter') ?? '';
      const wanted = /^name\[eq\]:"(.*)"$/.exec(filter)?.[1];
      const hit = stored.filter((c) => c.name === wanted);
      return jsonResponse(200, { data: { companies: hit } });
    });

    const client = new TwentyClient({
      apiKey: FAKE_TOKEN,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });

    for (const name of ['Acme, Inc', 'Acme (Pty) Ltd', 'Smith & Sons']) {
      const created = await client.createCompany({ name });
      const found = await client.findCompanyByName(name);
      expect(found, name + ' must be findable after being created').not.toBeNull();
      expect(found?.id).toBe(created?.id);
    }

    // Three creates, not six: no duplicates were made.
    expect(stored).toHaveLength(3);
  });
});
