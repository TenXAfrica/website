import { describe, expect, it } from 'vitest';
import { SELF_SERVE_QUESTIONS } from '../../shared/dma/questions';
import { scoreFull, scoreSelfServe } from '../../shared/dma/scoring';
import type { FullSubmission, SelfServeContact } from '../../shared/dma/types';
import {
  fencedJson,
  fullNoteTitle,
  mdEscape,
  renderContactNote,
  renderFullNote,
  renderFullTaskBody,
  renderSelfServeNote,
  renderSelfServeTaskBody,
  selfServeNoteTitle,
} from '../src/notes';

const CONTACT: SelfServeContact = {
  companyName: 'Acme Widgets',
  website: 'acme-widgets.co.uk',
  country: 'GB',
  size: 'S_6_20',
  sector: 'Manufacturing',
  fullName: 'Jane Smith',
  email: 'jane@acme-widgets.co.uk',
  biggestTimeSink: 'Re-typing orders into the accounting system',
  consent: true,
};

function manualAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of SELF_SERVE_QUESTIONS) answers[q.id] = q.options[0]!.value;
  return answers;
}

const ANSWERS = manualAnswers();
const RESULT = scoreSelfServe(ANSWERS, CONTACT);
const RECEIVED_AT = '2026-09-22T11:30:00.000Z';

const NOTE_INPUT = {
  contact: CONTACT,
  answers: ANSWERS,
  result: RESULT,
  receivedAt: RECEIVED_AT,
  version: 'dma-worker-test',
};

describe('mdEscape', () => {
  it('neutralises markdown control characters', () => {
    expect(mdEscape('**bold** [link](x)')).toBe('\\*\\*bold\\*\\* \\[link\\]\\(x\\)');
  });

  it('defuses an attempt to close a code fence', () => {
    expect(mdEscape('```js')).not.toContain('```');
  });

  it('normalises CRLF and trims', () => {
    expect(mdEscape('  a\r\nb  ')).toBe('a\nb');
  });
});

describe('fencedJson', () => {
  it('produces a parseable json fence', () => {
    const out = fencedJson({ a: 1, b: 'two' });
    expect(out.startsWith('```json\n')).toBe(true);
    expect(out.endsWith('\n```')).toBe(true);

    const inner = out.slice('```json\n'.length, -'\n```'.length);
    expect(JSON.parse(inner)).toEqual({ a: 1, b: 'two' });
  });

  it('cannot be broken out of by backticks in the payload', () => {
    const out = fencedJson({ note: 'see ``` this' });
    // Exactly two fences: the opener and the closer.
    expect(out.split('```')).toHaveLength(3);

    const inner = out.slice('```json\n'.length, -'\n```'.length);
    // The escaping is reversible: the routine still reads the original text.
    expect(JSON.parse(inner)).toEqual({ note: 'see ``` this' });
  });
});

describe('renderSelfServeNote', () => {
  const markdown = renderSelfServeNote(NOTE_INPUT);

  it('titles the note with the company and the score', () => {
    expect(selfServeNoteTitle(CONTACT, RESULT)).toBe('DMA self-serve score: Acme Widgets (0/100)');
  });

  it('leads with the score and the band', () => {
    expect(markdown).toContain('Acme Widgets');
    expect(markdown).toContain('0/100');
    expect(markdown).toContain(RESULT.band.label);
  });

  it('records who submitted it and on what terms', () => {
    expect(markdown).toContain('Jane Smith');
    expect(markdown).toContain('jane@acme-widgets.co.uk');
    expect(markdown).toContain('GB');
    expect(markdown).toContain('S_6_20');
    expect(markdown).toContain('yes, ticked');
    expect(markdown).toContain(RECEIVED_AT);
  });

  it('flags an unticked consent box loudly', () => {
    const out = renderSelfServeNote({
      ...NOTE_INPUT,
      contact: { ...CONTACT, consent: false },
    });
    expect(out).toContain('NOT ticked');
  });

  it('renders a dimension table with every dimension', () => {
    expect(markdown).toContain('| Dimension | Score | Band | Raw |');
    for (const d of RESULT.dimensions) {
      expect(markdown).toContain(d.label);
    }
  });

  it('renders the recommendations with price bands and ROI', () => {
    for (const rec of RESULT.recommendations) {
      expect(markdown).toContain(rec.label);
      expect(markdown).toContain(rec.priceBand.tier);
    }
    expect(markdown).toMatch(/\$[\d,]+/);
    expect(markdown).toContain('hrs/week');
  });

  it('carries the CRM fields Joash will check', () => {
    expect(markdown).toContain(RESULT.fitScore);
    expect(markdown).toContain('MANUAL_ADMIN');
  });

  it('lists every answer they gave', () => {
    for (const q of SELF_SERVE_QUESTIONS) {
      const option = q.options.find((o) => o.value === ANSWERS[q.id])!;
      // The label is escaped in the output, so compare on a distinctive
      // word rather than the whole string.
      const word = option.label.split(' ')[0]!.replace(/[^A-Za-z]/g, '');
      if (word.length > 3) expect(markdown).toContain(word);
    }
  });

  it('ends on the booking link', () => {
    expect(markdown).toContain('bookings.cloud.microsoft');
  });

  it('does not let prospect free text break the markdown', () => {
    const hostile = renderSelfServeNote({
      ...NOTE_INPUT,
      contact: {
        ...CONTACT,
        companyName: '# Acme **Widgets** [x](javascript:alert(1))',
        biggestTimeSink: '```json\n{"injected":true}\n```',
      },
    });
    expect(hostile).not.toContain('```');
    expect(hostile).not.toContain('[x](javascript');
  });

  it('omits the time-sink section when they did not fill it in', () => {
    const { biggestTimeSink: _drop, ...rest } = CONTACT;
    const out = renderSelfServeNote({ ...NOTE_INPUT, contact: rest });
    expect(out).not.toContain('in their words');
  });
});

describe('renderSelfServeTaskBody', () => {
  const body = renderSelfServeTaskBody(NOTE_INPUT);

  it('gives the @claude queue everything it needs in one glance', () => {
    expect(body).toContain('Acme Widgets');
    expect(body).toContain('0/100');
    expect(body).toContain(RESULT.fitScore);
    expect(body).toContain('jane@acme-widgets.co.uk');
    expect(body).toContain('CONSENTED');
    expect(body).toContain('bookings.cloud.microsoft');
  });

  it('warns when consent was not given', () => {
    const out = renderSelfServeTaskBody(
      { ...NOTE_INPUT, contact: { ...CONTACT, consent: false } },
      'no-contact'
    );
    expect(out).toContain('ASKED');
    expect(out).toContain('no outbound contact');
    expect(out).toContain('Do NOT email');
    // The routine must never be told to draft anything for these people.
    expect(out).not.toContain('draft the DMA invite');
    expect(out).not.toContain('bookings.cloud.microsoft');
  });
});

describe('renderFullNote', () => {
  const submission: FullSubmission = {
    version: 'dma-full-1',
    opportunityId: 'opp-123',
    companyId: 'co-123',
    companyName: 'Acme Widgets',
    hourlyRateUsd: 40,
    interviewer: 'Joash Paul',
    conductedAt: '2026-09-22T09:00:00.000Z',
    notes: { finance: 'Invoices go out whenever someone remembers.' },
    answers: [
      {
        questionId: 'finance-1',
        current: 'Typed into Sage from a paper job card.',
        tools: 'Sage, paper',
        owner: 'Bookkeeper',
        hoursPerWeek: 10,
        pain: 5,
        maturity: 0,
      },
      {
        questionId: 'sales-1',
        current: 'Shared inbox.',
        tools: 'Outlook',
        owner: 'Reception',
        hoursPerWeek: 3,
        pain: 3,
        maturity: 1,
      },
    ],
  };

  const result = scoreFull(submission);
  const input = {
    submission,
    result,
    version: 'dma-worker-test',
    receivedAt: RECEIVED_AT,
  };
  const markdown = renderFullNote(input);

  it('titles the note the way the routine looks it up', () => {
    expect(fullNoteTitle(submission)).toBe('DMA (full): Acme Widgets');
  });

  it('carries a human report', () => {
    expect(markdown).toContain('Acme Widgets');
    expect(markdown).toContain('Joash Paul');
    expect(markdown).toContain('| Dimension | Score | Band | Raw |');
    expect(markdown).toContain('Invoices go out whenever someone remembers');
    expect(markdown).toContain('Bookkeeper');
    expect(markdown).toContain('Sage');
  });

  it('carries exactly one machine-readable json block', () => {
    expect(markdown.split('```json')).toHaveLength(2);
    expect(markdown.split('```')).toHaveLength(3);
  });

  it('round-trips the submission and result through that block', () => {
    const start = markdown.indexOf('```json\n') + '```json\n'.length;
    const end = markdown.lastIndexOf('\n```');
    const parsed = JSON.parse(markdown.slice(start, end)) as {
      version: string;
      submission: FullSubmission;
      result: typeof result;
    };

    expect(parsed.version).toBe('dma-worker-test');
    expect(parsed.submission).toEqual(submission);
    expect(parsed.result).toEqual(result);
    // The routine builds the spec off these, so pin them explicitly.
    expect(parsed.submission.opportunityId).toBe('opp-123');
    expect(parsed.result.recommendations.length).toBeGreaterThan(0);
  });

  it('keeps the json block parseable when an interviewer pastes a fence', () => {
    const withFence: FullSubmission = {
      ...submission,
      notes: { finance: 'They said ```use this``` verbatim' },
    };
    const out = renderFullNote({ ...input, submission: withFence, result: scoreFull(withFence) });

    expect(out.split('```')).toHaveLength(3);
    const start = out.indexOf('```json\n') + '```json\n'.length;
    const end = out.lastIndexOf('\n```');
    const parsed = JSON.parse(out.slice(start, end)) as { submission: FullSubmission };
    expect(parsed.submission.notes.finance).toBe('They said ```use this``` verbatim');
  });
});

describe('renderFullTaskBody', () => {
  it('tells the routine what to do next', () => {
    const submission: FullSubmission = {
      version: 'dma-full-1',
      opportunityId: 'opp-123',
      companyName: 'Acme Widgets',
      hourlyRateUsd: 40,
      interviewer: 'Joash Paul',
      conductedAt: '2026-09-22T09:00:00.000Z',
      notes: {},
      answers: [
        {
          questionId: 'finance-1',
          current: 'Manual.',
          tools: 'Sage',
          owner: 'Bookkeeper',
          hoursPerWeek: 10,
          pain: 5,
          maturity: 0,
        },
      ],
    };
    const body = renderFullTaskBody({
      submission,
      result: scoreFull(submission),
      version: 'v',
      receivedAt: RECEIVED_AT,
    });

    expect(body).toContain('Acme Widgets');
    expect(body).toContain('JSON block');
    expect(body).toContain('catalogue/builds.md');
  });
});

describe('renderContactNote', () => {
  it('records the message and the consent position', () => {
    const out = renderContactNote({
      fullName: 'Jane Smith',
      email: 'jane@acme-widgets.co.uk',
      companyLabel: 'Acme Widgets',
      company: 'Acme Widgets',
      message: 'We want to talk about automating quoting.',
      consent: false,
      receivedAt: RECEIVED_AT,
    });

    expect(out).toContain('Jane Smith');
    expect(out).toContain('automating quoting');
    expect(out).toContain('NOT ticked');
    expect(out).toContain(RECEIVED_AT);
  });

  it('escapes a hostile message', () => {
    const out = renderContactNote({
      fullName: 'x',
      email: 'x@y.com',
      companyLabel: 'x',
      message: '```\n# OWNED\n```',
      consent: true,
      receivedAt: RECEIVED_AT,
    });
    expect(out).not.toContain('```');
  });
});
