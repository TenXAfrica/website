/**
 * Draft persistence for the guided DMA.
 *
 * The single most important property of this module: a dropped call, a closed
 * tab or a browser crash must never cost 45 minutes of interview. Everything
 * is written to localStorage, keyed by the Twenty Opportunity the DMA belongs
 * to, and every read/write is defensive — a corrupt or unreadable draft
 * degrades to "no draft", never to a thrown error that takes the page down.
 */

import type { DimensionId, FullAnswer } from '../../../../shared/dma/types';

export const DRAFT_PREFIX = 'tenx.dma.full.draft.v1';
export const TOKEN_KEY = 'tenx.dma.full.token.v1';

/** Where work lands before an Opportunity id has been pasted in. */
export const NO_OPPORTUNITY = '__no-opportunity__';

export interface SetupState {
  companyName: string;
  opportunityId: string;
  companyId: string;
  interviewer: string;
  hourlyRateUsd: number;
}

/**
 * The in-progress shape of a FullAnswer. Numeric fields are nullable while
 * the interviewer has not committed to a value yet; `null` survives a JSON
 * round trip, `undefined` does not.
 */
export interface AnswerDraft {
  current: string;
  tools: string;
  owner: string;
  hoursPerWeek: number | null;
  pain: FullAnswer['pain'] | null;
  maturity: FullAnswer['maturity'] | null;
}

export interface DraftState {
  v: 1;
  setup: SetupState;
  answers: Record<string, AnswerDraft>;
  notes: Partial<Record<DimensionId, string>>;
  savedAt: string;
}

export const DEFAULT_SETUP: SetupState = {
  companyName: '',
  opportunityId: '',
  companyId: '',
  interviewer: 'Joash Paul',
  hourlyRateUsd: 25,
};

export function emptyAnswer(): AnswerDraft {
  return {
    current: '',
    tools: '',
    owner: '',
    hoursPerWeek: null,
    pain: null,
    maturity: null,
  };
}

/** A question counts as scored — and therefore submittable — once maturity is set. */
export function answerIsScored(a: AnswerDraft | undefined): boolean {
  return !!a && a.maturity !== null;
}

/** Any keystroke at all. Used to decide what is worth saving and warning about. */
export function answerHasContent(a: AnswerDraft | undefined): boolean {
  if (!a) return false;
  return (
    a.current.trim() !== '' ||
    a.tools.trim() !== '' ||
    a.owner.trim() !== '' ||
    (a.hoursPerWeek !== null && a.hoursPerWeek > 0) ||
    a.pain !== null ||
    a.maturity !== null
  );
}

/** What the "x/30" counter means: a narrative and a maturity call. */
export function answerIsComplete(a: AnswerDraft | undefined): boolean {
  return !!a && a.maturity !== null && a.current.trim() !== '';
}

export function draftKey(opportunityId: string): string {
  const id = opportunityId.trim();
  return `${DRAFT_PREFIX}:${id === '' ? NO_OPPORTUNITY : id}`;
}

export function newDraft(setup: SetupState): DraftState {
  return {
    v: 1,
    setup,
    answers: {},
    notes: {},
    savedAt: new Date().toISOString(),
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}

function coerceAnswer(raw: unknown): AnswerDraft {
  const base = emptyAnswer();
  if (!isRecord(raw)) return base;
  const hours = raw.hoursPerWeek;
  const pain = raw.pain;
  const maturity = raw.maturity;
  return {
    current: str(raw.current),
    tools: str(raw.tools),
    owner: str(raw.owner),
    hoursPerWeek:
      typeof hours === 'number' && Number.isFinite(hours) && hours >= 0
        ? hours
        : null,
    pain:
      typeof pain === 'number' && pain >= 1 && pain <= 5
        ? (Math.round(pain) as FullAnswer['pain'])
        : null,
    maturity:
      typeof maturity === 'number' && maturity >= 0 && maturity <= 4
        ? (Math.round(maturity) as FullAnswer['maturity'])
        : null,
  };
}

function coerceDraft(raw: unknown): DraftState | null {
  if (!isRecord(raw)) return null;
  const setupRaw = isRecord(raw.setup) ? raw.setup : {};
  const rate = setupRaw.hourlyRateUsd;
  const setup: SetupState = {
    companyName: str(setupRaw.companyName),
    opportunityId: str(setupRaw.opportunityId),
    companyId: str(setupRaw.companyId),
    interviewer: str(setupRaw.interviewer, DEFAULT_SETUP.interviewer),
    hourlyRateUsd:
      typeof rate === 'number' && Number.isFinite(rate) && rate > 0
        ? rate
        : DEFAULT_SETUP.hourlyRateUsd,
  };

  const answers: Record<string, AnswerDraft> = {};
  if (isRecord(raw.answers)) {
    for (const [id, value] of Object.entries(raw.answers)) {
      answers[id] = coerceAnswer(value);
    }
  }

  const notes: Partial<Record<DimensionId, string>> = {};
  if (isRecord(raw.notes)) {
    for (const [id, value] of Object.entries(raw.notes)) {
      if (typeof value === 'string' && value !== '') {
        notes[id as DimensionId] = value;
      }
    }
  }

  return {
    v: 1,
    setup,
    answers,
    notes,
    savedAt: str(raw.savedAt, new Date().toISOString()),
  };
}

export function readDraft(key: string): DraftState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return coerceDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeDraft(key: string, state: DraftState): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/** True when the draft holds anything worth offering to restore. */
export function draftIsWorthRestoring(d: DraftState | null): boolean {
  if (!d) return false;
  if (Object.values(d.answers).some(answerHasContent)) return true;
  if (Object.values(d.notes).some((n) => (n ?? '').trim() !== '')) return true;
  return d.setup.companyName.trim() !== '';
}

export function countDraftAnswers(d: DraftState): number {
  return Object.values(d.answers).filter(answerHasContent).length;
}

/* ------------------------------------------------------------------ */
/* Worker token — kept out of the draft and out of the build           */
/* ------------------------------------------------------------------ */

export function readToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeToken(token: string): void {
  try {
    if (token === '') window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode; the token just will not be remembered */
  }
}
