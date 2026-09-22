/**
 * Guided (full) DMA handler.
 *
 * This is Joash's internal tool, gated on a shared bearer secret rather than
 * Turnstile. It is still validated strictly: the Note it writes is the build
 * spec, and the "@claude Process DMA" routine parses the JSON block out of
 * it, so a malformed answer here becomes a malformed proposal later.
 */

import type {
  DimensionId,
  FullAnswer,
  FullSubmission,
  ScoreResult,
} from '../../shared/dma/types';
import { DIMENSIONS } from '../../shared/dma/types';
import { FULL_DMA_QUESTIONS } from '../../shared/dma/questions';
import { scoreFull } from '../../shared/dma/scoring';
import {
  fullNoteTitle,
  mdInline,
  renderFullNote,
  renderFullTaskBody,
  type FullNoteInput,
} from './notes';
import { TwentyClient, logEvent } from './twenty';
import { LIMITS, nextWorkingDay, type ValidationResult } from './selfserve';

const KNOWN_QUESTION_IDS = new Set(FULL_DMA_QUESTIONS.map((q) => q.id));
const VALID_DIMENSIONS = new Set<string>(DIMENSIONS);

const MAX_ANSWERS = 60;
const MAX_HOURLY_RATE = 5000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cap(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateFull(body: unknown): ValidationResult<FullSubmission> {
  const errors: string[] = [];

  if (!isPlainObject(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }

  if (body['version'] !== 'dma-full-1') {
    errors.push('version must be "dma-full-1"');
  }

  const opportunityId = str(body['opportunityId']);
  if (!opportunityId) errors.push('opportunityId is required');
  else if (opportunityId.length > 64) errors.push('opportunityId is too long');

  const companyId = str(body['companyId']);
  if (companyId && companyId.length > 64) errors.push('companyId is too long');

  const companyName = str(body['companyName']);
  if (!companyName) errors.push('companyName is required');
  else if (companyName.length > LIMITS.company) errors.push('companyName is too long');

  const interviewer = str(body['interviewer']);
  if (!interviewer) errors.push('interviewer is required');
  else if (interviewer.length > LIMITS.name) errors.push('interviewer is too long');

  const conductedAt = str(body['conductedAt']);
  if (!conductedAt) errors.push('conductedAt is required');
  else if (Number.isNaN(Date.parse(conductedAt))) {
    errors.push('conductedAt must be an ISO date');
  }

  const rawRate = body['hourlyRateUsd'];
  let hourlyRateUsd = 0;
  if (typeof rawRate !== 'number' || !Number.isFinite(rawRate) || rawRate < 0) {
    errors.push('hourlyRateUsd must be a non-negative number');
  } else if (rawRate > MAX_HOURLY_RATE) {
    errors.push('hourlyRateUsd exceeds ' + MAX_HOURLY_RATE);
  } else {
    hourlyRateUsd = Math.round(rawRate * 100) / 100;
  }

  /* --- answers --- */
  const rawAnswers = body['answers'];
  const answers: FullAnswer[] = [];
  if (!Array.isArray(rawAnswers)) {
    errors.push('answers must be an array');
  } else if (rawAnswers.length === 0) {
    errors.push('answers must not be empty');
  } else if (rawAnswers.length > MAX_ANSWERS) {
    errors.push('answers exceeds ' + MAX_ANSWERS + ' entries');
  } else {
    const seen = new Set<string>();
    rawAnswers.forEach((entry, i) => {
      if (!isPlainObject(entry)) {
        errors.push('answers[' + i + '] must be an object');
        return;
      }
      const questionId = str(entry['questionId']);
      if (!KNOWN_QUESTION_IDS.has(questionId)) {
        errors.push('answers[' + i + '] has unknown questionId: ' + questionId.slice(0, 40));
        return;
      }
      if (seen.has(questionId)) {
        errors.push('answers[' + i + '] duplicates questionId ' + questionId);
        return;
      }
      seen.add(questionId);

      const hoursPerWeek =
        typeof entry['hoursPerWeek'] === 'number' &&
        Number.isFinite(entry['hoursPerWeek']) &&
        (entry['hoursPerWeek'] as number) >= 0 &&
        (entry['hoursPerWeek'] as number) <= 168
          ? Math.round((entry['hoursPerWeek'] as number) * 10) / 10
          : null;
      if (hoursPerWeek === null) {
        errors.push('answers[' + i + '].hoursPerWeek must be 0-168');
        return;
      }

      const pain = intInRange(entry['pain'], 1, 5);
      if (pain === null) {
        errors.push('answers[' + i + '].pain must be 1-5');
        return;
      }

      const maturity = intInRange(entry['maturity'], 0, 4);
      if (maturity === null) {
        errors.push('answers[' + i + '].maturity must be 0-4');
        return;
      }

      answers.push({
        questionId,
        current: cap(str(entry['current']), LIMITS.freeText),
        tools: cap(str(entry['tools']), LIMITS.freeText),
        owner: cap(str(entry['owner']), LIMITS.name),
        hoursPerWeek,
        pain: pain as FullAnswer['pain'],
        maturity: maturity as FullAnswer['maturity'],
      });
    });
  }

  /* --- per-dimension notes --- */
  const rawNotes = body['notes'];
  const notes: Partial<Record<DimensionId, string>> = {};
  if (rawNotes !== undefined) {
    if (!isPlainObject(rawNotes)) {
      errors.push('notes must be an object of dimensionId -> text');
    } else {
      for (const [key, value] of Object.entries(rawNotes)) {
        if (!VALID_DIMENSIONS.has(key)) {
          errors.push('notes contains unknown dimension: ' + key.slice(0, 40));
          continue;
        }
        if (typeof value !== 'string') {
          errors.push('notes.' + key + ' must be a string');
          continue;
        }
        const text = cap(value.trim(), LIMITS.freeText);
        if (text) notes[key as DimensionId] = text;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const submission: FullSubmission = {
    version: 'dma-full-1',
    opportunityId,
    companyName,
    hourlyRateUsd,
    answers,
    notes,
    interviewer,
    conductedAt,
  };
  if (companyId) submission.companyId = companyId;

  return { ok: true, value: submission };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export interface FullDeps {
  twenty: TwentyClient;
  version: string;
  now?: () => Date;
}

export interface FullHandlerResult {
  status: number;
  body:
    | { ok: true; result: ScoreResult }
    | { ok: false; error: string; details?: string[] };
}

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logEvent('warn', 'crm-step-failed:' + label, err);
    return null;
  }
}

export async function handleFull(body: unknown, deps: FullDeps): Promise<FullHandlerResult> {
  const validated = validateFull(body);
  if (!validated.ok) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_submission', details: validated.errors.slice(0, 15) },
    };
  }

  const submission = validated.value;
  const result = scoreFull(submission);
  const receivedAt = (deps.now?.() ?? new Date()).toISOString();

  const noteInput: FullNoteInput = {
    submission,
    result,
    version: deps.version,
    receivedAt,
  };

  const failures: string[] = [];

  /* --- Note, carrying both the report and the JSON block --- */
  const note = await attempt('full-create-note', () =>
    deps.twenty.createNote({
      title: fullNoteTitle(submission),
      bodyV2: { markdown: renderFullNote(noteInput) },
      position: 'first',
    })
  );
  if (!note) failures.push('note');

  if (note?.id) {
    const target = await attempt('full-note-target-opportunity', () =>
      deps.twenty.createNoteTarget({
        noteId: note.id,
        opportunityId: submission.opportunityId,
      })
    );
    if (!target) failures.push('note-target-opportunity');

    if (submission.companyId) {
      const companyTarget = await attempt('full-note-target-company', () =>
        deps.twenty.createNoteTarget({
          noteId: note.id,
          companyId: submission.companyId,
        })
      );
      if (!companyTarget) failures.push('note-target-company');
    }
  }

  /* --- The DMA happened, so the opportunity is qualified --- */
  const patched = await attempt('full-qualify-opportunity', () =>
    deps.twenty.updateOpportunity(submission.opportunityId, { stage: 'QUALIFIED' })
  );
  if (!patched) failures.push('opportunity-stage');

  /* --- Task for the @claude queue --- */
  const now = new Date(receivedAt);
  const task = await attempt('full-create-task', () =>
    deps.twenty.createTask({
      title: '@claude Process DMA: ' + mdInline(submission.companyName, 120),
      status: 'TODO',
      dueAt: nextWorkingDay(Number.isNaN(now.getTime()) ? new Date() : now).toISOString(),
      bodyV2: { markdown: renderFullTaskBody(noteInput) },
      position: 'first',
    })
  );
  if (!task) failures.push('task');

  if (task?.id) {
    await attempt('full-task-target-opportunity', () =>
      deps.twenty.createTaskTarget({
        taskId: task.id,
        opportunityId: submission.opportunityId,
      })
    );
    if (submission.companyId) {
      await attempt('full-task-target-company', () =>
        deps.twenty.createTaskTarget({
          taskId: task.id,
          companyId: submission.companyId,
        })
      );
    }
  }

  if (failures.length > 0) {
    logEvent('warn', 'full-partial-crm-write', { failures });
  } else {
    logEvent('info', 'full-crm-write-ok');
  }

  return { status: 200, body: { ok: true, result } };
}
