import { describe, expect, it } from 'vitest';
import { SELF_SERVE_QUESTIONS } from '../../shared/dma/questions';
import {
  LIMITS,
  nextWorkingDay,
  splitName,
  toPrimaryLinkUrl,
  validateContact,
  validateSelfServe,
} from '../src/selfserve';
import { validateFull } from '../src/full';

/** Every question answered with its most-manual option. */
function manualAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of SELF_SERVE_QUESTIONS) {
    answers[q.id] = q.options[0]!.value;
  }
  return answers;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    version: 'dma-selfserve-1',
    answers: manualAnswers(),
    contact: {
      companyName: 'Acme Widgets',
      website: 'acme-widgets.co.uk',
      country: 'GB',
      size: 'S_6_20',
      sector: 'Manufacturing',
      fullName: 'Jane Smith',
      email: 'jane@acme-widgets.co.uk',
      biggestTimeSink: 'Re-typing orders into the accounting system',
      consent: true,
    },
    turnstileToken: 'turnstile-token-value',
    ...overrides,
  };
}

function errorsFor(body: unknown): string[] {
  const result = validateSelfServe(body);
  return result.ok ? [] : result.errors;
}

describe('validateSelfServe', () => {
  it('accepts a well-formed submission', () => {
    const result = validateSelfServe(validBody());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contact.companyName).toBe('Acme Widgets');
    expect(result.value.contact.email).toBe('jane@acme-widgets.co.uk');
    expect(Object.keys(result.value.answers)).toHaveLength(SELF_SERVE_QUESTIONS.length);
  });

  it('lowercases the email and never trusts client submittedAt', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['email'] = '  Jane@ACME-Widgets.co.uk ';
    (body as Record<string, unknown>)['submittedAt'] = '1999-01-01T00:00:00.000Z';

    const result = validateSelfServe(body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contact.email).toBe('jane@acme-widgets.co.uk');
    expect(result.value).not.toHaveProperty('submittedAt');
  });

  /* ------------------------- answers ------------------------- */

  it('rejects an unknown question id', () => {
    const body = validBody();
    (body.answers as Record<string, string>)['not_a_question'] = 's1a';
    expect(errorsFor(body).join(' ')).toContain('unknown question id');
  });

  it('rejects a known question with an option value from another question', () => {
    const body = validBody();
    (body.answers as Record<string, string>)['s1'] = 'f1a';
    expect(errorsFor(body).join(' ')).toContain('invalid option for question s1');
  });

  it('rejects a made-up option value', () => {
    const body = validBody();
    (body.answers as Record<string, string>)['s1'] = 'definitely-not-an-option';
    expect(errorsFor(body).join(' ')).toContain('invalid option for question s1');
  });

  it('rejects a partially answered assessment', () => {
    const body = validBody();
    delete (body.answers as Record<string, string>)['d2'];
    expect(errorsFor(body).join(' ')).toContain('every question must be answered');
  });

  it('rejects answers that are not an object', () => {
    expect(errorsFor(validBody({ answers: ['s1a'] })).join(' ')).toContain('answers must be an object');
    expect(errorsFor(validBody({ answers: 's1a' })).join(' ')).toContain('answers must be an object');
  });

  /* ------------------------- version ------------------------- */

  it('rejects a wrong or missing version', () => {
    expect(errorsFor(validBody({ version: 'dma-selfserve-2' })).join(' ')).toContain('version');
    expect(errorsFor(validBody({ version: undefined })).join(' ')).toContain('version');
  });

  /* -------------------------- strings ------------------------ */

  it('rejects an over-long company name', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['companyName'] = 'A'.repeat(LIMITS.company + 1);
    expect(errorsFor(body).join(' ')).toContain('companyName exceeds 200');
  });

  it('rejects an over-long email', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['email'] =
      'x'.repeat(LIMITS.email) + '@acme.com';
    expect(errorsFor(body).join(' ')).toContain('contact.email');
  });

  it('rejects over-long free text', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['biggestTimeSink'] = 'x'.repeat(LIMITS.freeText + 1);
    expect(errorsFor(body).join(' ')).toContain('biggestTimeSink exceeds 2000');
  });

  it('accepts free text exactly at the cap', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['biggestTimeSink'] = 'x'.repeat(LIMITS.freeText);
    expect(validateSelfServe(body).ok).toBe(true);
  });

  /* --------------------------- email ------------------------- */

  it.each([
    'not-an-email',
    'no-at-sign.com',
    'two@@at.com',
    'trailing@dot.',
    'spaces in@email.com',
    'missing@tld',
    'double..dot@acme.com',
    '@acme.com',
  ])('rejects the malformed email %s', (email) => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['email'] = email;
    expect(errorsFor(body).join(' ')).toContain('contact.email');
  });

  it.each([
    'jane@acme.com',
    'jane.smith+dma@acme-widgets.co.uk',
    'j@a.io',
  ])('accepts the valid email %s', (email) => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['email'] = email;
    expect(validateSelfServe(body).ok).toBe(true);
  });

  /* -------------------------- consent ------------------------ */

  it('rejects a missing consent field', () => {
    const body = validBody();
    delete (body.contact as Record<string, unknown>)['consent'];
    expect(errorsFor(body).join(' ')).toContain('consent must be true or false');
  });

  it('rejects a truthy non-boolean consent', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['consent'] = 'yes';
    expect(errorsFor(body).join(' ')).toContain('consent must be true or false');
  });

  it('accepts an explicit false consent', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['consent'] = false;
    const result = validateSelfServe(body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.contact.consent).toBe(false);
  });

  /* ---------------------- other required --------------------- */

  it('rejects an unknown company size', () => {
    const body = validBody();
    (body.contact as Record<string, unknown>)['size'] = 'S_1000_PLUS';
    expect(errorsFor(body).join(' ')).toContain('contact.size must be one of');
  });

  it('rejects a missing turnstile token', () => {
    expect(errorsFor(validBody({ turnstileToken: '' })).join(' ')).toContain('turnstileToken');
    expect(errorsFor(validBody({ turnstileToken: undefined })).join(' ')).toContain('turnstileToken');
  });

  it('rejects a non-object body', () => {
    for (const body of [null, 'string', 42, [], undefined]) {
      expect(validateSelfServe(body).ok).toBe(false);
    }
  });
});

describe('validateContact', () => {
  const base = {
    fullName: 'Jane Smith',
    email: 'jane@acme-widgets.co.uk',
    company: 'Acme Widgets',
    message: 'We would like to talk about automating our quoting.',
    consent: true,
    turnstileToken: 'turnstile-token-value',
  };

  it('accepts a well-formed contact submission', () => {
    expect(validateContact(base).ok).toBe(true);
  });

  it('accepts a submission with no company', () => {
    const { company: _company, ...rest } = base;
    expect(validateContact(rest).ok).toBe(true);
  });

  it('requires a message, a valid email and a token', () => {
    expect(validateContact({ ...base, message: '' }).ok).toBe(false);
    expect(validateContact({ ...base, email: 'nope' }).ok).toBe(false);
    expect(validateContact({ ...base, turnstileToken: '' }).ok).toBe(false);
  });

  it('caps the message at the free-text limit', () => {
    const result = validateContact({ ...base, message: 'x'.repeat(LIMITS.freeText + 1) });
    expect(result.ok).toBe(false);
  });

  it('treats a missing consent tick as false rather than rejecting', () => {
    const { consent: _consent, ...rest } = base;
    const result = validateContact(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.consent).toBe(false);
  });
});

describe('validateFull', () => {
  const base = {
    version: 'dma-full-1',
    opportunityId: '9f1c2b7a-0000-4000-8000-000000000001',
    companyId: '9f1c2b7a-0000-4000-8000-000000000002',
    companyName: 'Acme Widgets',
    hourlyRateUsd: 35,
    interviewer: 'Joash Paul',
    conductedAt: '2026-09-22T09:00:00.000Z',
    answers: [
      {
        questionId: 'sales-1',
        current: 'Shared inbox, first person to see it replies.',
        tools: 'Outlook',
        owner: 'Reception',
        hoursPerWeek: 6,
        pain: 4,
        maturity: 1,
      },
    ],
    notes: { sales: 'No CRM at all. Everything is in the inbox.' },
  };

  it('accepts a well-formed full submission', () => {
    const result = validateFull(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answers).toHaveLength(1);
  });

  it('requires an opportunityId', () => {
    const result = validateFull({ ...base, opportunityId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('opportunityId');
  });

  it('rejects an unknown questionId', () => {
    const result = validateFull({
      ...base,
      answers: [{ ...base.answers[0], questionId: 'sales-99' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('unknown questionId');
  });

  it('rejects duplicate questionIds', () => {
    const result = validateFull({ ...base, answers: [base.answers[0], base.answers[0]] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('duplicates questionId');
  });

  it.each([
    ['pain', 0],
    ['pain', 6],
    ['maturity', -1],
    ['maturity', 5],
    ['hoursPerWeek', -1],
    ['hoursPerWeek', 200],
  ])('rejects %s out of range (%s)', (field, value) => {
    const result = validateFull({
      ...base,
      answers: [{ ...base.answers[0], [field]: value }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown dimension in notes', () => {
    const result = validateFull({ ...base, notes: { marketing: 'nope' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('unknown dimension');
  });

  it('rejects an empty answers array', () => {
    const result = validateFull({ ...base, answers: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects a wrong version', () => {
    expect(validateFull({ ...base, version: 'dma-full-2' }).ok).toBe(false);
  });
});

describe('field helpers', () => {
  it('normalises a website into a primaryLinkUrl', () => {
    expect(toPrimaryLinkUrl('acme-widgets.co.uk')).toBe('https://acme-widgets.co.uk');
    expect(toPrimaryLinkUrl('http://www.acme.com/contact?x=1')).toBe('https://acme.com');
    expect(toPrimaryLinkUrl('HTTPS://WWW.Acme.COM')).toBe('https://acme.com');
  });

  it('returns null for things that are not websites', () => {
    expect(toPrimaryLinkUrl(undefined)).toBeNull();
    expect(toPrimaryLinkUrl('')).toBeNull();
    expect(toPrimaryLinkUrl('localhost')).toBeNull();
    expect(toPrimaryLinkUrl('javascript:alert(1)')).toBeNull();
    expect(toPrimaryLinkUrl('not a url at all')).toBeNull();
  });

  it('splits names sensibly', () => {
    expect(splitName('Jane Smith')).toEqual({ firstName: 'Jane', lastName: 'Smith' });
    expect(splitName('Jane Mary Smith')).toEqual({ firstName: 'Jane', lastName: 'Mary Smith' });
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
    expect(splitName('  Jane   Smith  ')).toEqual({ firstName: 'Jane', lastName: 'Smith' });
  });

  it('rolls a weekend due date forward to Monday', () => {
    // 2026-09-25 is a Friday, so +1 day lands on Saturday -> Monday the 28th.
    expect(nextWorkingDay(new Date('2026-09-25T10:00:00Z')).getUTCDate()).toBe(28);
    // Saturday the 26th -> +1 is Sunday -> Monday the 28th.
    expect(nextWorkingDay(new Date('2026-09-26T10:00:00Z')).getUTCDate()).toBe(28);
    // Tuesday the 22nd -> Wednesday the 23rd.
    expect(nextWorkingDay(new Date('2026-09-22T10:00:00Z')).getUTCDate()).toBe(23);
  });
});
