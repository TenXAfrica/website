/**
 * Markdown rendering for the CRM Notes this Worker writes.
 *
 * Two audiences read these:
 *   - Joash, in the Twenty timeline, who wants the answer in ten seconds.
 *   - The "@claude Process DMA" routine, which parses the fenced JSON block.
 *
 * So the full-DMA note carries a human report AND a machine block. Keep the
 * JSON block last and keep its fence intact: `fencedJson` below escapes any
 * backticks in the payload so a hostile or accidental ``` in free text cannot
 * close the fence early.
 */

import type {
  BuildRecommendation,
  DimensionScore,
  FullSubmission,
  ScoreResult,
  SelfServeContact,
} from '../../shared/dma/types';
import { DIMENSION_META } from '../../shared/dma/questions';
import { SELF_SERVE_QUESTIONS } from '../../shared/dma/questions';

export const BOOKING_URL =
  'https://bookings.cloud.microsoft/book/DiscoveryCall@tenxafrica.co.za/';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Neutralise markdown control characters in text we did not write.
 *
 * Deliberately narrower than "escape everything". Over-escaping made emails
 * read as `jane@acme\-widgets.co.uk` and enum values as `S\_6\_20` in the CRM,
 * which is worse than useless -- Joash copies those out of the note. So:
 *
 *   - Always escaped: the characters that can change the document structure
 *     (fences, links, emphasis, table cells, raw HTML).
 *   - Escaped only at the start of a line: the ones that are block markers
 *     there and ordinary punctuation anywhere else (# - +).
 *   - Never escaped: `_`, because CommonMark does not treat intraword
 *     underscores as emphasis, and it appears in every size and signal enum.
 */
export function mdEscape(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\\`*[\]()|<>~]/g, (ch) => '\\' + ch)
    .replace(/^([#+-]|\d+\.)/gm, '\\$1')
    .trim();
}

/**
 * Single-line version for table cells, headings and record titles.
 *
 * Exported because note and task TITLES need it too: a title is the same
 * injection channel as a body. An unescaped companyName of
 * `DMA (full): Acme` would otherwise let a submitter collide with the
 * full-DMA note title namespace that the processing routine looks up by.
 */
export function mdInline(value: string, maxLen = 300): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  const clipped = flat.length > maxLen ? flat.slice(0, maxLen) + '...' : flat;
  return mdEscape(clipped);
}

/**
 * For record TITLES. A Twenty title is a plain-text field, not markdown, so
 * markdown escaping there just leaves stray backslashes in the CRM
 * ("Acme \\(Pty\\) Ltd"), and a title filter such as title[eq] would then
 * never match the real name. What a title still needs: one line, no control
 * characters, no backticks (a routine may quote it into a note), a length
 * cap. The injection risk lives in bodies, which keep mdInline.
 */
export function plainInline(value: string, maxLen = 120): string {
  const flat = value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen) + '...' : flat;
}

/**
 * Render untrusted multi-line text as a blockquote.
 *
 * Uses mdEscape rather than mdInline so real line breaks survive -- mdInline
 * collapses all whitespace, which silently turned every long contact message
 * into a single line.
 */
export function blockquote(value: string, maxLen = 2000): string {
  const clipped = value.length > maxLen ? value.slice(0, maxLen) + '...' : value;
  return mdEscape(clipped)
    .split('\n')
    .map((line) => '> ' + line)
    .join('\n');
}

/**
 * Serialise a payload into a ```json fence that cannot be broken out of.
 * Backticks are re-encoded as `, which is still valid JSON, so the
 * routine's `JSON.parse` sees the original string.
 */
export function fencedJson(payload: unknown): string {
  const raw = JSON.stringify(payload, null, 2) ?? 'null';
  const safe = raw.replace(/`/g, '\\u0060');
  return '```json\n' + safe + '\n```';
}

function usd(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function dimensionTable(dimensions: DimensionScore[]): string {
  const rows = dimensions.map(
    (d) =>
      '| ' +
      mdInline(d.label) +
      ' | ' +
      d.score +
      '/100 | ' +
      d.band +
      ' | ' +
      d.raw.earned +
      '/' +
      d.raw.available +
      ' |'
  );
  return [
    '| Dimension | Score | Band | Raw |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function recommendationBlock(recs: BuildRecommendation[]): string {
  if (recs.length === 0) {
    return 'No build stands out. Everything they answered is already automated, so the conversation is decision support, not admin removal.';
  }
  return recs
    .map((r, i) => {
      const lines = [
        '**' +
          (i + 1) +
          '. ' +
          mdInline(r.label) +
          '** (signal ' +
          r.strength +
          '/100, ' +
          r.priceBand.tier +
          ' ' +
          usd(r.priceBand.low) +
          '-' +
          usd(r.priceBand.high) +
          ')',
        '',
        mdInline(r.summary, 400),
      ];
      if (r.drivers.length > 0) {
        lines.push('', 'Driven by: ' + r.drivers.join(', ') + '.');
      }
      if (r.roi) {
        lines.push(
          '',
          'Estimated recovery: ' +
            r.roi.hoursPerWeekRecovered +
            ' hrs/week, ' +
            r.roi.annualHoursRecovered +
            ' hrs/year, about ' +
            usd(r.roi.annualValueUsd) +
            ' a year.'
        );
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Self-serve note                                                     */
/* ------------------------------------------------------------------ */

export interface SelfServeNoteInput {
  contact: SelfServeContact;
  answers: Record<string, string>;
  result: ScoreResult;
  /** Server-side timestamp. The client's `submittedAt` is not trusted. */
  receivedAt: string;
  version: string;
}

export function selfServeNoteTitle(contact: SelfServeContact, result: ScoreResult): string {
  // A title is the same injection channel as a body, so the company name is
  // escaped and length-capped exactly like body text.
  return (
    'DMA self-serve score: ' +
    plainInline(contact.companyName, 120) +
    ' (' +
    result.overall +
    '/100)'
  );
}

export function renderSelfServeNote(input: SelfServeNoteInput): string {
  const { contact, result, answers, receivedAt } = input;

  const answerLines = SELF_SERVE_QUESTIONS.map((q) => {
    const chosen = answers[q.id];
    const option = q.options.find((o) => o.value === chosen);
    if (!option) return null;
    return (
      '- **' +
      mdInline(q.prompt) +
      '**  \n  ' +
      mdInline(option.label) +
      ' _(' +
      option.score +
      '/4)_'
    );
  }).filter((line): line is string => line !== null);

  const sections: string[] = [
    '# Digital Maturity Assessment -- self-serve',
    '',
    '**' +
      mdInline(contact.companyName) +
      '** scored **' +
      result.overall +
      '/100** -- ' +
      mdInline(result.band.label) +
      '.',
    '',
    mdInline(result.band.meaning, 600),
    '',
    '## Who submitted it',
    '',
    '- Name: ' + mdInline(contact.fullName),
    '- Email: ' + mdInline(contact.email),
    '- Country: ' + mdInline(contact.country),
    '- Size: ' + mdInline(contact.size),
  ];

  if (contact.sector) sections.push('- Sector: ' + mdInline(contact.sector));
  if (contact.website) sections.push('- Website: ' + mdInline(contact.website));
  sections.push(
    '- Consent to contact: ' + (contact.consent ? 'yes, ticked' : 'NOT ticked'),
    '- Received (server time): ' + receivedAt
  );

  if (contact.biggestTimeSink) {
    sections.push(
      '',
      '## Biggest weekly time-sink, in their words',
      '',
      blockquote(contact.biggestTimeSink)
    );
  }

  sections.push('', '## Scores by dimension', '', dimensionTable(result.dimensions));

  if (typeof result.estimatedHoursPerWeek === 'number') {
    sections.push(
      '',
      'Self-reported manual admin: **' +
        result.estimatedHoursPerWeek +
        ' hours a week** across the business.'
    );
  }

  sections.push(
    '',
    '## What we would build first',
    '',
    recommendationBlock(result.recommendations),
    '',
    '## CRM',
    '',
    '- Fit score: ' + result.fitScore,
    '- Signals: ' + (result.signals.length ? result.signals.join(', ') : 'none'),
    '',
    '## Their answers',
    '',
    answerLines.join('\n'),
    '',
    '## Next step',
    '',
    'Invite them to the full Digital Maturity Assessment: ' + BOOKING_URL,
    '',
    '_Written by the DMA Worker. Numbers come from shared/dma/scoring.ts._'
  );

  return sections.join('\n');
}

/** Short body for the "@claude Follow up DMA score" task. */
/**
 * The body of the @claude task. `mode` decides the instruction at the end:
 * 'invite' asks the routine to draft the DMA invite; 'no-contact' tells it
 * to record the score and do nothing outbound. The caller picks 'no-contact'
 * for an OPTED_OUT company and for anyone who did not tick consent.
 */
export function renderSelfServeTaskBody(
  input: SelfServeNoteInput,
  mode: 'invite' | 'no-contact' = 'invite'
): string {
  const { contact, result } = input;
  const top = result.recommendations[0];
  const lines = [
    mdInline(contact.companyName) +
      ' scored ' +
      result.overall +
      '/100 (' +
      mdInline(result.band.label) +
      '), fit ' +
      result.fitScore +
      '.',
    '',
    'Contact: ' + mdInline(contact.fullName) + ', ' + mdInline(contact.email),
    'Country: ' + mdInline(contact.country) + ' | Size: ' + mdInline(contact.size),
    'Consent: ' + (contact.consent ? 'CONSENTED' : 'ASKED -- not ticked, no outbound contact'),
  ];

  if (contact.biggestTimeSink) {
    lines.push('', 'Says their biggest time-sink is: ' + mdInline(contact.biggestTimeSink, 500));
  }
  if (top) {
    lines.push(
      '',
      'Lead recommendation: ' +
        mdInline(top.label) +
        ' (' +
        top.priceBand.tier +
        ' ' +
        usd(top.priceBand.low) +
        '-' +
        usd(top.priceBand.high) +
        ').'
    );
  }

  if (mode === 'invite') {
    lines.push(
      '',
      'Do: read the score Note on the Company, then draft the DMA invite.',
      'Booking link: ' + BOOKING_URL
    );
  } else {
    lines.push(
      '',
      'Do NOT email, draft or otherwise contact them: there is no consent on record.',
      'Record the score against the Company and stop. The booking link was on their screen if they want the call.'
    );
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Full DMA note                                                       */
/* ------------------------------------------------------------------ */

export interface FullNoteInput {
  submission: FullSubmission;
  result: ScoreResult;
  version: string;
  receivedAt: string;
}

export function fullNoteTitle(submission: FullSubmission): string {
  return 'DMA (full): ' + plainInline(submission.companyName, 120);
}

export function renderFullNote(input: FullNoteInput): string {
  const { submission, result, version, receivedAt } = input;

  const byDimension = new Map<string, typeof submission.answers>();
  for (const answer of submission.answers) {
    const dimension = answer.questionId.split('-')[0] ?? 'other';
    const bucket = byDimension.get(dimension) ?? [];
    bucket.push(answer);
    byDimension.set(dimension, bucket);
  }

  const sections: string[] = [
    '# Digital Maturity Assessment -- full',
    '',
    '**' +
      mdInline(submission.companyName) +
      '** scored **' +
      result.overall +
      '/100** -- ' +
      mdInline(result.band.label) +
      '.',
    '',
    mdInline(result.band.meaning, 600),
    '',
    '- Interviewer: ' + mdInline(submission.interviewer),
    '- Conducted: ' + mdInline(submission.conductedAt),
    '- Recorded (server time): ' + receivedAt,
    '- Blended hourly rate used: ' + usd(submission.hourlyRateUsd) + '/hr',
    '- Opportunity: ' + mdInline(submission.opportunityId),
    '',
    '## Scores by dimension',
    '',
    dimensionTable(result.dimensions),
  ];

  if (typeof result.estimatedHoursPerWeek === 'number') {
    sections.push(
      '',
      'Total measured manual load: **' +
        result.estimatedHoursPerWeek +
        ' hours a week**.'
    );
  }

  sections.push('', '## Recommended builds', '', recommendationBlock(result.recommendations));

  sections.push('', '## Findings by dimension', '');
  for (const meta of DIMENSION_META) {
    const answers = byDimension.get(meta.id);
    const note = submission.notes[meta.id];
    if (!answers && !note) continue;

    sections.push('### ' + mdInline(meta.label), '');
    if (note) sections.push(blockquote(note), '');
    for (const answer of answers ?? []) {
      sections.push(
        '- **' +
          mdInline(answer.questionId) +
          '** -- maturity ' +
          answer.maturity +
          '/4, pain ' +
          answer.pain +
          '/5, ' +
          answer.hoursPerWeek +
          ' hrs/week, owner ' +
          mdInline(answer.owner || 'unstated') +
          '  \n  Today: ' +
          mdInline(answer.current, 800) +
          '  \n  Tools: ' +
          mdInline(answer.tools || 'none named')
      );
    }
    sections.push('');
  }

  sections.push(
    '## CRM',
    '',
    '- Fit score: ' + result.fitScore,
    '- Signals: ' + (result.signals.length ? result.signals.join(', ') : 'none'),
    '',
    '## Machine-readable payload',
    '',
    'The "@claude Process DMA" routine parses the block below. Do not edit it by hand.',
    '',
    fencedJson({ version, submission, result })
  );

  return sections.join('\n');
}

/** Short body for the "@claude Process DMA" task. */
export function renderFullTaskBody(input: FullNoteInput): string {
  const { submission, result } = input;
  const top = result.recommendations
    .map((r) => mdInline(r.label))
    .join(', ');

  return [
    mdInline(submission.companyName) +
      ' scored ' +
      result.overall +
      '/100 (' +
      mdInline(result.band.label) +
      ').',
    '',
    'Recommended: ' + (top || 'nothing stood out'),
    typeof result.estimatedHoursPerWeek === 'number'
      ? 'Measured manual load: ' + result.estimatedHoursPerWeek + ' hrs/week.'
      : 'No hours recorded.',
    '',
    'Do: parse the JSON block in the "DMA (full)" Note on this opportunity,',
    'turn it into the build spec, then draft the proposal off catalogue/builds.md.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Contact form note                                                   */
/* ------------------------------------------------------------------ */

export interface ContactNoteInput {
  fullName: string;
  email: string;
  companyLabel: string;
  company?: string;
  website?: string;
  phone?: string;
  message: string;
  consent: boolean;
  receivedAt: string;
}

export function contactNoteTitle(input: ContactNoteInput): string {
  return 'Contact form: ' + plainInline(input.companyLabel, 120);
}

export function renderContactNote(input: ContactNoteInput): string {
  const lines = [
    '# Contact form submission',
    '',
    '- Name: ' + mdInline(input.fullName),
    '- Email: ' + mdInline(input.email),
    '- Company: ' + mdInline(input.company || 'not given'),
  ];
  if (input.website) lines.push('- Website: ' + mdInline(input.website));
  if (input.phone) lines.push('- Phone: ' + mdInline(input.phone));
  lines.push(
    '- Consent to contact: ' + (input.consent ? 'yes, ticked' : 'NOT ticked'),
    '- Received (server time): ' + input.receivedAt,
    '',
    '## Message',
    '',
    blockquote(input.message),
    '',
    '_Written by the DMA Worker from the website contact form._'
  );
  return lines.join('\n');
}
