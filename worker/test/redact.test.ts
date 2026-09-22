import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRegisteredSecrets,
  redact,
  registerSecret,
  unwrapMany,
  unwrapOne,
} from '../src/twenty';

/**
 * The single rule these tests exist to defend: the Twenty bearer token must
 * never reach a log line, an error message or a response body.
 */

const FAKE_TOKEN = 'tok_test_0000000000000000000000000000_not_real';

afterEach(() => {
  clearRegisteredSecrets();
});

describe('redact', () => {
  it('removes values under sensitive-looking keys', () => {
    const out = redact({
      url: 'https://crm.tenxafrica.co.za/rest/companies',
      headers: { Authorization: 'Bearer ' + FAKE_TOKEN, Accept: 'application/json' },
    });

    expect(out).not.toContain(FAKE_TOKEN);
    expect(out).toContain('[redacted]');
    // Non-sensitive context must survive, or the log is useless.
    expect(out).toContain('crm.tenxafrica.co.za/rest/companies');
    expect(out).toContain('application/json');
  });

  it('catches nested sensitive keys and varied spellings', () => {
    const out = redact({
      outer: { api_key: FAKE_TOKEN, nested: { apiKey: FAKE_TOKEN } },
      list: [{ secret: FAKE_TOKEN }],
    });
    expect(out).not.toContain(FAKE_TOKEN);
  });

  it('removes a Bearer run found inside free text', () => {
    const out = redact('upstream said: Authorization: Bearer ' + FAKE_TOKEN + ' is invalid');
    expect(out).not.toContain(FAKE_TOKEN);
    expect(out).toContain('Bearer [redacted]');
  });

  it('removes a registered secret wherever it appears', () => {
    registerSecret(FAKE_TOKEN);
    // A bare token with no "Bearer" prefix and no sensitive key name: the
    // only thing that can save us here is registration.
    const out = redact({ message: 'token rejected: ' + FAKE_TOKEN });
    expect(out).not.toContain(FAKE_TOKEN);
    expect(out).toContain('[redacted]');
  });

  it('ignores registration of implausibly short values', () => {
    registerSecret('abc');
    expect(redact('abc def')).toContain('abc');
  });

  it('masks email addresses', () => {
    const out = redact({ note: 'lead from jane.smith@acme-widgets.co.uk arrived' });
    expect(out).not.toContain('jane.smith@acme-widgets.co.uk');
    expect(out).toContain('[email]');
  });

  it('renders an Error without leaking its stack', () => {
    const err = new TypeError('fetch failed');
    const out = redact(err);
    expect(out).toContain('TypeError');
    expect(out).toContain('fetch failed');
    expect(out).not.toContain('at ');
  });

  it('survives circular structures', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a['self'] = a;
    expect(() => redact(a)).not.toThrow();
    expect(redact(a)).toContain('[circular]');
  });

  it('truncates long input so one bad body cannot flood the log', () => {
    const out = redact('x'.repeat(5000), 100);
    expect(out.length).toBeLessThan(200);
    expect(out).toContain('more)');
  });

  it('never throws on exotic input', () => {
    expect(() => redact(undefined)).not.toThrow();
    expect(() => redact(null)).not.toThrow();
    expect(() => redact(12345)).not.toThrow();
    expect(() => redact(Symbol('x') as unknown)).not.toThrow();
  });
});

describe('response envelope decoding', () => {
  it('unwraps the documented { data: { createCompany } } shape', () => {
    const rec = unwrapOne({ data: { createCompany: { id: 'c1', name: 'Acme' } } }, [
      'createCompany',
    ]);
    expect(rec?.id).toBe('c1');
  });

  it('unwraps { data: { record } } and a bare record', () => {
    expect(unwrapOne({ data: { id: 'c2' } })?.id).toBe('c2');
    expect(unwrapOne({ id: 'c3' })?.id).toBe('c3');
  });

  it('unwraps a single-key envelope we did not predict', () => {
    expect(unwrapOne({ data: { somethingNew: { id: 'c4' } } })?.id).toBe('c4');
  });

  it('returns null rather than guessing when there is no record', () => {
    expect(unwrapOne({ data: {} })).toBeNull();
    expect(unwrapOne({ data: { createCompany: { noId: true } } })).toBeNull();
    expect(unwrapOne(null)).toBeNull();
    expect(unwrapOne('nope')).toBeNull();
  });

  it('unwraps list shapes', () => {
    expect(unwrapMany({ data: { companies: [{ id: 'a' }, { id: 'b' }] } }, ['companies'])).toHaveLength(2);
    expect(unwrapMany({ data: [{ id: 'a' }] })).toHaveLength(1);
    expect(unwrapMany([{ id: 'a' }, { noId: 1 }])).toHaveLength(1);
    expect(unwrapMany({ data: {} })).toEqual([]);
  });
});
