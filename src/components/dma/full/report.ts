/**
 * Turns the interview draft into the two things that must survive the call:
 * the FullSubmission the Worker expects, and a human-readable markdown report
 * Joash can paste straight into the CRM Note if the POST ever fails.
 */

import { DIMENSION_META } from '../../../../shared/dma/questions';
import { FULL_DMA_QUESTIONS } from '../../../../shared/dma/questions';
import { WORKING_WEEKS } from '../../../../shared/dma/scoring';
import type {
  DimensionId,
  FullAnswer,
  FullSubmission,
  ScoreResult,
} from '../../../../shared/dma/types';
import { answerHasContent, type AnswerDraft, type SetupState } from './draft';

export const MATURITY_ANCHORS: { value: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { value: 0, label: 'Fully manual' },
  { value: 1, label: 'Manual with notes' },
  { value: 2, label: 'Templated / semi-manual' },
  { value: 3, label: 'System, manually driven' },
  { value: 4, label: 'Runs itself' },
];

export const PAIN_ANCHORS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Fine as is' },
  { value: 2, label: 'Mild niggle' },
  { value: 3, label: 'Annoying' },
  { value: 4, label: 'Costly' },
  { value: 5, label: 'Actively painful' },
];

export function maturityLabel(v: number | null): string {
  return MATURITY_ANCHORS.find((a) => a.value === v)?.label ?? 'Not scored';
}

export function painLabel(v: number | null): string {
  return PAIN_ANCHORS.find((a) => a.value === v)?.label ?? 'Not rated';
}

export const QUESTIONS_BY_DIMENSION: {
  dimension: DimensionId;
  label: string;
  blurb: string;
  weight: number;
  questions: typeof FULL_DMA_QUESTIONS;
}[] = DIMENSION_META.map((meta) => ({
  dimension: meta.id,
  label: meta.label,
  blurb: meta.blurb,
  weight: meta.weight,
  questions: FULL_DMA_QUESTIONS.filter((q) => q.dimension === meta.id),
}));

export const TOTAL_QUESTIONS = FULL_DMA_QUESTIONS.length;

/**
 * Only answers with a maturity call are scoreable, so those are what the live
 * rail uses. `includeUnscored` adds anything with content, defaulting maturity
 * to 0, which is what submit does after warning about it — losing the
 * interviewer's typed narrative would be worse than a slightly harsh score.
 */
export function buildAnswers(
  answers: Record<string, AnswerDraft>,
  includeUnscored: boolean
): FullAnswer[] {
  const out: FullAnswer[] = [];
  for (const q of FULL_DMA_QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    const scored = a.maturity !== null;
    if (!scored && !(includeUnscored && answerHasContent(a))) continue;
    out.push({
      questionId: q.id,
      current: a.current.trim(),
      tools: a.tools.trim(),
      owner: a.owner.trim(),
      hoursPerWeek: a.hoursPerWeek ?? 0,
      pain: a.pain ?? 3,
      maturity: a.maturity ?? 0,
    });
  }
  return out;
}

export function buildSubmission(
  setup: SetupState,
  answers: Record<string, AnswerDraft>,
  notes: Partial<Record<DimensionId, string>>,
  opts: { includeUnscored: boolean; conductedAt?: string }
): FullSubmission {
  const cleanNotes: Partial<Record<DimensionId, string>> = {};
  for (const [id, value] of Object.entries(notes)) {
    const trimmed = (value ?? '').trim();
    if (trimmed !== '') cleanNotes[id as DimensionId] = trimmed;
  }

  return {
    version: 'dma-full-1',
    opportunityId: setup.opportunityId.trim(),
    ...(setup.companyId.trim() !== '' ? { companyId: setup.companyId.trim() } : {}),
    companyName: setup.companyName.trim(),
    hourlyRateUsd: setup.hourlyRateUsd,
    answers: buildAnswers(answers, opts.includeUnscored),
    notes: cleanNotes,
    interviewer: setup.interviewer.trim(),
    conductedAt: opts.conductedAt ?? new Date().toISOString(),
  };
}

export interface ReportEnvelope {
  version: 'dma-full-1';
  submission: FullSubmission;
  result: ScoreResult;
}

export function buildEnvelope(
  submission: FullSubmission,
  result: ScoreResult
): ReportEnvelope {
  return { version: 'dma-full-1', submission, result };
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');

function dateLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function buildMarkdown(
  submission: FullSubmission,
  result: ScoreResult
): string {
  const byId = new Map(submission.answers.map((a) => [a.questionId, a]));
  const lines: string[] = [];

  lines.push(`# Digital Maturity Assessment — ${submission.companyName || 'Untitled'}`);
  lines.push('');
  lines.push(
    `Conducted ${dateLine(submission.conductedAt)} by ${submission.interviewer || 'Ten X Africa'}.`
  );
  lines.push(
    `Opportunity \`${submission.opportunityId}\`${
      submission.companyId ? ` · Company \`${submission.companyId}\`` : ''
    } · blended rate ${usd(submission.hourlyRateUsd)}/hour.`
  );
  lines.push('');

  lines.push('## Overall');
  lines.push('');
  lines.push(`**${result.overall}/100 — ${result.band.label}**`);
  lines.push('');
  lines.push(result.band.meaning);
  lines.push('');
  lines.push(
    `Provisional fit score: ${result.fitScore.replace('RATING_', '')}/5 · ${submission.answers.length} of ${TOTAL_QUESTIONS} questions captured.`
  );

  if (result.estimatedHoursPerWeek && result.estimatedHoursPerWeek > 0) {
    const annualHours = Math.round(result.estimatedHoursPerWeek * WORKING_WEEKS);
    lines.push('');
    lines.push(
      `Roughly **${num(result.estimatedHoursPerWeek)} hours a week** goes on the manual work described below — about ${annualHours.toLocaleString('en-US')} hours a year, or ${usd(annualHours * submission.hourlyRateUsd)} at the blended rate.`
    );
  }
  lines.push('');

  lines.push('## Dimension scores');
  lines.push('');
  lines.push('| Dimension | Score | Band |');
  lines.push('| --- | --- | --- |');
  for (const d of result.dimensions) {
    lines.push(`| ${d.label} | ${d.score}/100 | ${d.band} |`);
  }
  lines.push('');

  if (result.recommendations.length > 0) {
    lines.push('## Recommended builds');
    lines.push('');
    result.recommendations.forEach((rec, i) => {
      lines.push(`### ${i + 1}. ${rec.label}`);
      lines.push('');
      lines.push(rec.summary);
      lines.push('');
      lines.push(
        `- Price band: ${rec.priceBand.tier} — ${usd(rec.priceBand.low)} to ${usd(rec.priceBand.high)}`
      );
      lines.push(`- Signal strength: ${rec.strength}/100`);
      lines.push(
        `- Driven by: ${rec.drivers
          .map((d) => DIMENSION_META.find((m) => m.id === d)?.label ?? d)
          .join(', ')}`
      );
      if (rec.roi) {
        lines.push(
          `- Estimated recovery: ${num(rec.roi.hoursPerWeekRecovered)} hours a week, ${rec.roi.annualHoursRecovered.toLocaleString('en-US')} hours a year, about ${usd(rec.roi.annualValueUsd)} a year`
        );
      }
      lines.push('');
    });
  }

  if (result.signals.length > 0) {
    lines.push(`**CRM signals:** ${result.signals.join(', ')}`);
    lines.push('');
  }

  lines.push('## Findings by dimension');
  lines.push('');

  for (const group of QUESTIONS_BY_DIMENSION) {
    const captured = group.questions.filter((q) => byId.has(q.id));
    const note = submission.notes[group.dimension];
    if (captured.length === 0 && !note) continue;

    lines.push(`### ${group.label}`);
    lines.push('');

    for (const q of captured) {
      const a = byId.get(q.id)!;
      lines.push(`**${q.prompt}**`);
      lines.push('');
      if (a.current) lines.push(`- Today: ${a.current.replace(/\n+/g, ' ')}`);
      if (a.tools) lines.push(`- Tools: ${a.tools}`);
      if (a.owner) lines.push(`- Owner: ${a.owner}`);
      if (a.hoursPerWeek > 0) lines.push(`- Hours a week: ${num(a.hoursPerWeek)}`);
      lines.push(
        `- Pain: ${a.pain}/5 (${painLabel(a.pain)}) · Maturity: ${a.maturity}/4 (${maturityLabel(a.maturity)})`
      );
      lines.push('');
    }

    if (note) {
      lines.push(`_Interviewer notes:_ ${note}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'Ten X Africa (Pty) Ltd · tenxafrica.co.za'
  );
  lines.push('');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Clipboard + download, both with fallbacks                           */
/* ------------------------------------------------------------------ */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the execCommand path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadFile(
  filename: string,
  contents: string,
  mime: string
): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'dma'
  );
}
