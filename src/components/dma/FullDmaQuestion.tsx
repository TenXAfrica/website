/**
 * One question of the guided DMA. Captures exactly the six FullAnswer fields.
 *
 * Memoised on purpose: thirty of these are mounted at once and a keystroke in
 * one must not re-render the other twenty-nine.
 */

import { memo, type KeyboardEvent } from 'react';
import type { Question } from '../../../shared/dma/types';
import type { AnswerDraft } from './full/draft';
import { emptyAnswer } from './full/draft';
import {
  AutoGrowTextarea,
  NumberField,
  ScaleSelector,
  TextField,
} from './full/fields';
import {
  MATURITY_ANCHORS,
  PAIN_ANCHORS,
  maturityLabel,
  painLabel,
} from './full/report';

export interface FullDmaQuestionProps {
  question: Question;
  /** 1-based position across all thirty, shown to keep pace in the call. */
  index: number;
  answer: AnswerDraft | undefined;
  onPatch: (questionId: string, patch: Partial<AnswerDraft>) => void;
  onStep: (questionId: string, direction: 1 | -1) => void;
}

export const questionCardId = (id: string) => `q-card-${id}`;
export const questionFieldId = (id: string, field: string) => `q-${id}-${field}`;

function FullDmaQuestionInner({
  question,
  index,
  answer,
  onPatch,
  onStep,
}: FullDmaQuestionProps) {
  const a = answer ?? emptyAnswer();
  const fid = (field: string) => questionFieldId(question.id, field);

  const scored = a.maturity !== null;
  const hasText = a.current.trim() !== '';

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onStep(question.id, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onStep(question.id, -1);
    }
  };

  return (
    <article
      id={questionCardId(question.id)}
      onKeyDown={handleKeyDown}
      aria-labelledby={`${questionCardId(question.id)}-prompt`}
      className={
        'scroll-mt-32 rounded-lg border bg-white/[0.02] p-3 sm:p-4 ' +
        (scored
          ? 'border-tenx-gold/25'
          : hasText
            ? 'border-amber-400/30'
            : 'border-rule')
      }
    >
      <header className="mb-3 flex items-start gap-3">
        <span
          className={
            'mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-heading text-xs font-semibold tabular-nums ' +
            (scored
              ? 'bg-tenx-gold/20 text-tenx-gold'
              : 'bg-rule text-text-faint')
          }
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={`${questionCardId(question.id)}-prompt`}
            className="font-heading text-[15px] leading-snug font-semibold text-vapor-white"
          >
            {question.prompt}
          </h3>
          {question.help && (
            <p className="mt-0.5 text-xs leading-snug text-text-faint">
              {question.help}
            </p>
          )}
        </div>
        {hasText && !scored && (
          <span className="shrink-0 rounded border border-amber-400/40 px-1.5 py-0.5 text-xs font-medium tracking-wide text-amber-300/90 uppercase">
            No maturity
          </span>
        )}
      </header>

      <div className="space-y-3">
        <AutoGrowTextarea
          id={fid('current')}
          label="How it works today"
          value={a.current}
          onChange={(v) => onPatch(question.id, { current: v })}
          minRows={3}
        />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
          <TextField
            id={fid('tools')}
            label="Tools named"
            value={a.tools}
            onChange={(v) => onPatch(question.id, { tools: v })}
          />
          <TextField
            id={fid('owner')}
            label="Who does it"
            value={a.owner}
            onChange={(v) => onPatch(question.id, { owner: v })}
          />
          <NumberField
            id={fid('hours')}
            label="Hours / week"
            value={a.hoursPerWeek}
            onChange={(v) => onPatch(question.id, { hoursPerWeek: v })}
            step={0.5}
            min={0}
          />
        </div>

        <ScaleSelector
          name={`${question.id}-pain`}
          legend="Pain"
          options={PAIN_ANCHORS}
          value={a.pain}
          onChange={(v) => onPatch(question.id, { pain: v })}
          trailing={
            <span className="truncate text-xs text-text-faint">
              {painLabel(a.pain)}
            </span>
          }
        />

        <ScaleSelector
          name={`${question.id}-maturity`}
          legend="Maturity"
          options={MATURITY_ANCHORS}
          value={a.maturity}
          onChange={(v) => onPatch(question.id, { maturity: v })}
          trailing={
            <span className="truncate text-xs text-text-faint">
              {maturityLabel(a.maturity)}
            </span>
          }
        />
      </div>

      <footer className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-2">
        <span className="text-xs text-text-faint">
          Alt + arrow keys move between questions
        </span>
        <button
          type="button"
          onClick={() => onStep(question.id, 1)}
          className="rounded border border-border-interactive px-2.5 py-1 text-xs font-medium text-text-muted hover:border-tenx-gold hover:text-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold"
        >
          Next question
        </button>
      </footer>
    </article>
  );
}

export const FullDmaQuestion = memo(FullDmaQuestionInner);
export default FullDmaQuestion;
