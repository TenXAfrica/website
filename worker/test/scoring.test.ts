import { describe, expect, it } from 'vitest';
import { SELF_SERVE_QUESTIONS } from '../../shared/dma/questions';
import { scoreFull, scoreSelfServe } from '../../shared/dma/scoring';
import type { FullSubmission, SelfServeContact } from '../../shared/dma/types';
import { needFor } from '../src/selfserve';

/**
 * These are integration tests over the shared scorer, not unit tests of it.
 * The scorer belongs to shared/dma and this Worker must not change it -- what
 * is pinned here is the behaviour the Worker relies on when it decides what
 * to write into the CRM.
 */

const CONTACT: SelfServeContact = {
  companyName: 'Acme Widgets',
  country: 'GB',
  size: 'S_6_20',
  fullName: 'Jane Smith',
  email: 'jane@acme-widgets.co.uk',
  consent: true,
};

/** Pick option N (0 = most manual, 4 = most automated) for every question. */
function answersAtIndex(index: number): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of SELF_SERVE_QUESTIONS) {
    answers[q.id] = q.options[index]!.value;
  }
  return answers;
}

function answersFrom(picks: Record<string, number>): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of SELF_SERVE_QUESTIONS) {
    const index = picks[q.id] ?? 0;
    answers[q.id] = q.options[index]!.value;
  }
  return answers;
}

describe('scoreSelfServe -- a fully manual business', () => {
  const result = scoreSelfServe(answersAtIndex(0), CONTACT);

  it('scores at the bottom of the scale', () => {
    expect(result.overall).toBe(0);
    expect(result.band.id).toBe('manual');
    expect(result.dimensions).toHaveLength(6);
    expect(result.dimensions.every((d) => d.score === 0)).toBe(true);
  });

  it('is a strong fit: low maturity on a company of our size', () => {
    expect(result.fitScore).toBe('RATING_5');
  });

  it('raises the manual-admin signals the CRM expects', () => {
    expect(result.signals).toContain('MANUAL_ADMIN');
    expect(result.signals).toContain('SLOW_RESPONSE');
    expect(result.signals).toContain('HIRING_ADMIN');
  });

  it('recommends builds, priced and with ROI attached', () => {
    expect(result.recommendations).toHaveLength(2);
    expect(result.estimatedHoursPerWeek).toBe(20);
    for (const rec of result.recommendations) {
      expect(rec.strength).toBeGreaterThan(0);
      expect(rec.priceBand.low).toBeGreaterThan(0);
      expect(rec.priceBand.high).toBeGreaterThan(rec.priceBand.low);
      expect(rec.roi?.annualValueUsd).toBeGreaterThan(0);
      expect(rec.drivers.length).toBeGreaterThan(0);
    }
  });

  it('leads with the build that gives the most hours back', () => {
    // Every dimension is maximally manual. The two strongest signals make
    // the cut, and because hours are known they are then presented in order
    // of hours recovered: the intake portal automates more of its share
    // than the dashboard does. Pinned so a question-bank or catalogue edit
    // that shifts the lead recommendation is a visible test failure, not a
    // silent change.
    expect(result.recommendations.map((r) => r.buildType)).toEqual([
      'intake_portal',
      'ops_dashboard',
    ]);
    const [first, second] = result.recommendations;
    expect(first!.roi!.hoursPerWeekRecovered).toBeGreaterThanOrEqual(
      second!.roi!.hoursPerWeekRecovered
    );
  });
});

describe('scoreSelfServe -- manual sales and finance, automated elsewhere', () => {
  // Manual enquiry handling, manual quoting, manual invoicing and chasing,
  // manual handoffs. Everything else already runs itself.
  const result = scoreSelfServe(
    answersFrom({ s1: 0, s2: 0, o1: 4, o2: 4, f1: 0, f2: 0, p1: 0, p2: 4, d1: 4, d2: 4, a1: 4, a2: 4 }),
    CONTACT
  );

  it('recommends inbox triage and quote-to-invoice', () => {
    const builds = result.recommendations.map((r) => r.buildType);
    expect(builds).toContain('quote_to_invoice');
    expect(builds).toContain('inbox_triage');
  });

  it('scores the manual dimensions low and the automated ones high', () => {
    const byId = new Map(result.dimensions.map((d) => [d.dimension, d.score]));
    expect(byId.get('sales')).toBe(0);
    expect(byId.get('finance')).toBe(0);
    expect(byId.get('data')).toBe(100);
    expect(byId.get('ai')).toBe(100);
  });
});

describe('scoreSelfServe -- a fully automated business', () => {
  const result = scoreSelfServe(answersAtIndex(4), CONTACT);

  it('scores at the top of the scale', () => {
    expect(result.overall).toBe(100);
    expect(result.band.id).toBe('optimised');
    expect(result.dimensions.every((d) => d.score === 100)).toBe(true);
  });

  it('raises no manual-work signals and recommends nothing', () => {
    expect(result.signals).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('scores as a weaker fit: there is little left to fix', () => {
    // overall >= 85 costs a point, so the same company that rated 5 while
    // manual rates lower once everything already runs itself.
    expect(result.fitScore).not.toBe('RATING_5');
  });
});

describe('scoreSelfServe -- fit score reacts to size and market', () => {
  const manual = answersAtIndex(0);

  it('marks a sole trader down and a mid-sized business up', () => {
    const solo = scoreSelfServe(manual, { ...CONTACT, size: 'S_1_5' });
    const mid = scoreSelfServe(manual, { ...CONTACT, size: 'S_21_50' });
    expect(Number(solo.fitScore.slice(-1))).toBeLessThan(Number(mid.fitScore.slice(-1)));
  });

  it('gives a tier-1 market the edge over an unlisted one', () => {
    const uk = scoreSelfServe(manual, { ...CONTACT, country: 'GB', size: 'S_51_200' });
    const other = scoreSelfServe(manual, { ...CONTACT, country: 'BR', size: 'S_51_200' });
    expect(Number(uk.fitScore.slice(-1))).toBeGreaterThanOrEqual(
      Number(other.fitScore.slice(-1))
    );
  });
});

describe('needFor', () => {
  const result = scoreSelfServe(answersAtIndex(0), CONTACT);

  it('prefers the prospect own words', () => {
    const need = needFor(
      { ...CONTACT, biggestTimeSink: 'Re-typing orders into Sage' },
      result
    );
    expect(need).toBe('Re-typing orders into Sage');
  });

  it('falls back to the top recommendation label', () => {
    const need = needFor(CONTACT, result);
    expect(need).toBe(result.recommendations[0]!.label);
  });

  it('never returns an empty string', () => {
    const empty = scoreSelfServe({}, CONTACT);
    expect(needFor(CONTACT, empty).length).toBeGreaterThan(0);
  });
});

describe('scoreFull', () => {
  const submission: FullSubmission = {
    version: 'dma-full-1',
    opportunityId: 'opp-1',
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
        questionId: 'finance-2',
        current: 'Someone phones round on a Friday.',
        tools: 'Phone',
        owner: 'Owner',
        hoursPerWeek: 4,
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

  it('scores low when the interviewer rated everything manual', () => {
    expect(result.overall).toBeLessThan(25);
    expect(result.band.id).toBe('manual');
  });

  it('totals the measured hours', () => {
    expect(result.estimatedHoursPerWeek).toBe(17);
  });

  it('leads with quote-to-invoice when finance is the deepest pain', () => {
    expect(result.recommendations[0]?.buildType).toBe('quote_to_invoice');
  });

  it('values recovered hours at the rate the interviewer recorded', () => {
    const roi = result.recommendations[0]?.roi;
    expect(roi).toBeDefined();
    expect(roi!.annualValueUsd).toBe(roi!.annualHoursRecovered * 40);
  });

  it('flags manual admin on the company', () => {
    expect(result.signals).toContain('MANUAL_ADMIN');
  });

  it('ignores answers to questions that are not in the bank', () => {
    const withJunk = scoreFull({
      ...submission,
      answers: [
        ...submission.answers,
        {
          questionId: 'not-a-question',
          current: '',
          tools: '',
          owner: '',
          hoursPerWeek: 99,
          pain: 5,
          maturity: 0,
        },
      ],
    });
    expect(withJunk.overall).toBe(result.overall);
  });
});
