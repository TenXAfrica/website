/**
 * The guided Digital Maturity Assessment — the internal tool Joash fills in
 * live during the 45-minute call.
 *
 * Non-negotiables baked into this component:
 *  - Nothing steals focus, nothing auto-advances, nothing animates text.
 *  - Every keystroke is debounced into localStorage, keyed by Opportunity id,
 *    and flushed again when the tab is hidden or closed. A dropped call must
 *    never cost the interview.
 *  - Copy report and Download JSON always work, token or no token, network or
 *    no network, so a failed POST never costs the call either.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { FULL_DMA_QUESTIONS } from '../../../shared/dma/questions';
import { scoreFull } from '../../../shared/dma/scoring';
import type { DimensionId, ScoreResult } from '../../../shared/dma/types';

import FullDmaQuestion, {
  questionCardId,
  questionFieldId,
} from './FullDmaQuestion';
import {
  DEFAULT_SETUP,
  clearDraft,
  countDraftAnswers,
  draftIsWorthRestoring,
  draftKey,
  emptyAnswer,
  readDraft,
  readToken,
  writeDraft,
  writeToken,
  answerHasContent,
  answerIsComplete,
  answerIsScored,
  type AnswerDraft,
  type DraftState,
  type SetupState,
} from './full/draft';
import {
  DimensionBar,
  DimensionSidebar,
  dimensionSectionId,
  type DimensionProgress,
} from './full/DimensionNav';
import SetupHeader from './full/SetupHeader';
import SummaryRail from './full/SummaryRail';
import { AutoGrowTextarea, LABEL_BASE } from './full/fields';
import {
  QUESTIONS_BY_DIMENSION,
  TOTAL_QUESTIONS,
  buildEnvelope,
  buildMarkdown,
  buildSubmission,
  copyText,
  downloadFile,
  slug,
} from './full/report';

import { DMA_WORKER_URL } from './util';

const WORKER_URL: string = DMA_WORKER_URL;

const SAVE_DEBOUNCE_MS = 600;
const SCORE_DEBOUNCE_MS = 350;

/* ------------------------------------------------------------------ */
/* URL handoff                                                         */
/* ------------------------------------------------------------------ */

function readUrlSetup(): {
  values: Partial<SetupState>;
  fromUrl: Set<keyof SetupState>;
} {
  const values: Partial<SetupState> = {};
  const fromUrl = new Set<keyof SetupState>();
  if (typeof window === 'undefined') return { values, fromUrl };

  const p = new URLSearchParams(window.location.search);
  const take = (param: string, field: 'companyName' | 'opportunityId' | 'companyId' | 'interviewer') => {
    const v = p.get(param);
    if (v !== null && v.trim() !== '') {
      values[field] = v.trim();
      fromUrl.add(field);
    }
  };

  take('company', 'companyName');
  take('companyName', 'companyName');
  take('opportunityId', 'opportunityId');
  take('companyId', 'companyId');
  take('interviewer', 'interviewer');

  const rate = p.get('rate');
  if (rate !== null && Number.isFinite(Number(rate)) && Number(rate) > 0) {
    values.hourlyRateUsd = Number(rate);
    fromUrl.add('hourlyRateUsd');
  }

  return { values, fromUrl };
}

/* ------------------------------------------------------------------ */

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'failed' };

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

interface RestoreOffer {
  key: string;
  draft: DraftState;
}

export function FullDma() {
  const urlSetup = useMemo(readUrlSetup, []);

  const [setup, setSetup] = useState<SetupState>(() => ({
    ...DEFAULT_SETUP,
    ...urlSetup.values,
  }));
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [notes, setNotes] = useState<Partial<Record<DimensionId, string>>>({});
  const [token, setToken] = useState('');

  const [setupOpen, setSetupOpen] = useState(true);
  const [restoreOffer, setRestoreOffer] = useState<RestoreOffer | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' });
  const [liveResult, setLiveResult] = useState<ScoreResult | null>(null);
  const [finalReport, setFinalReport] = useState<{
    markdown: string;
    result: ScoreResult;
  } | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const handledKeysRef = useRef<Set<string>>(new Set());
  const backedUpKeysRef = useRef<Set<string>>(new Set());
  const latestRef = useRef({ setup, answers, notes });
  latestRef.current = { setup, answers, notes };

  /* ---------------- token ---------------- */

  useEffect(() => {
    setToken(readToken());
  }, []);

  const handleToken = useCallback((v: string) => {
    setToken(v);
    writeToken(v);
  }, []);

  /* ---------------- patching ---------------- */

  const patchSetup = useCallback((patch: Partial<SetupState>) => {
    dirtyRef.current = true;
    setSetup((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchAnswer = useCallback(
    (questionId: string, patch: Partial<AnswerDraft>) => {
      dirtyRef.current = true;
      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...(prev[questionId] ?? emptyAnswer()), ...patch },
      }));
    },
    []
  );

  const patchNote = useCallback((dimension: DimensionId, value: string) => {
    dirtyRef.current = true;
    setNotes((prev) => ({ ...prev, [dimension]: value }));
  }, []);

  const stepTo = useCallback((questionId: string, direction: 1 | -1) => {
    const i = FULL_DMA_QUESTIONS.findIndex((q) => q.id === questionId);
    const next = FULL_DMA_QUESTIONS[i + direction];
    if (!next) return;
    document
      .getElementById(questionCardId(next.id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const field = document.getElementById(questionFieldId(next.id, 'current'));
    if (field instanceof HTMLTextAreaElement) field.focus({ preventScroll: true });
  }, []);

  /* ---------------- autosave ---------------- */

  const persist = useCallback(() => {
    if (!dirtyRef.current) return;
    const { setup: s, answers: a, notes: n } = latestRef.current;
    const key = draftKey(s.opportunityId);

    // Before this session overwrites somebody else's draft at the same key for
    // the first time, keep a copy. Cheap insurance against a misclick.
    if (!backedUpKeysRef.current.has(key)) {
      backedUpKeysRef.current.add(key);
      const existing = readDraft(key);
      if (draftIsWorthRestoring(existing) && existing) {
        writeDraft(`${key}.superseded`, existing);
      }
    }

    const ok = writeDraft(key, {
      v: 1,
      setup: s,
      answers: a,
      notes: n,
      savedAt: new Date().toISOString(),
    });
    setSaveStatus(ok ? { kind: 'saved', at: Date.now() } : { kind: 'failed' });
  }, []);

  useEffect(() => {
    if (!dirtyRef.current) return;
    setSaveStatus({ kind: 'saving' });
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persist();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [setup, answers, notes, persist]);

  // A closing tab, a locked laptop or a browser crash must not beat the debounce.
  useEffect(() => {
    const flush = () => persist();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (dirtyRef.current && !submittedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  /* ---------------- restore offer ---------------- */

  useEffect(() => {
    const key = draftKey(setup.opportunityId);
    if (handledKeysRef.current.has(key)) return;
    const draft = readDraft(key);
    if (draft && draftIsWorthRestoring(draft)) {
      setRestoreOffer({ key, draft });
    } else {
      setRestoreOffer(null);
    }
  }, [setup.opportunityId]);

  const acceptRestore = useCallback(() => {
    setRestoreOffer((offer) => {
      if (!offer) return null;
      handledKeysRef.current.add(offer.key);
      backedUpKeysRef.current.add(offer.key);
      const d = offer.draft;
      setSetup((prev) => ({
        companyName: d.setup.companyName || prev.companyName,
        opportunityId: d.setup.opportunityId || prev.opportunityId,
        companyId: d.setup.companyId || prev.companyId,
        interviewer: d.setup.interviewer || prev.interviewer,
        hourlyRateUsd: d.setup.hourlyRateUsd || prev.hourlyRateUsd,
      }));
      setAnswers(d.answers);
      setNotes(d.notes);
      dirtyRef.current = true;
      setToast('Draft restored.');
      return null;
    });
  }, []);

  const ignoreRestore = useCallback(() => {
    setRestoreOffer((offer) => {
      if (offer) handledKeysRef.current.add(offer.key);
      return null;
    });
  }, []);

  /* ---------------- derived ---------------- */

  const totals = useMemo(() => {
    let hours = 0;
    let complete = 0;
    let scored = 0;
    let withContent = 0;
    for (const q of FULL_DMA_QUESTIONS) {
      const a = answers[q.id];
      if (!a) continue;
      if (a.hoursPerWeek) hours += a.hoursPerWeek;
      if (answerIsComplete(a)) complete += 1;
      if (answerIsScored(a)) scored += 1;
      if (answerHasContent(a)) withContent += 1;
    }
    return { hours, complete, scored, withContent };
  }, [answers]);

  const progress: DimensionProgress[] = useMemo(
    () =>
      QUESTIONS_BY_DIMENSION.map((g) => {
        let complete = 0;
        let unscored = 0;
        for (const q of g.questions) {
          const a = answers[q.id];
          if (answerIsComplete(a)) complete += 1;
          else if (answerHasContent(a)) unscored += 1;
        }
        return {
          dimension: g.dimension,
          label: g.label,
          complete,
          total: g.questions.length,
          unscored,
        };
      }),
    [answers]
  );

  /* live score, debounced */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const submission = buildSubmission(setup, answers, notes, {
        includeUnscored: false,
      });
      setLiveResult(
        submission.answers.length > 0 ? scoreFull(submission) : null
      );
    }, SCORE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [setup, answers, notes]);

  /* which dimension is on screen */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let active: DimensionId | null = null;
      for (const g of QUESTIONS_BY_DIMENSION) {
        const el = document.getElementById(dimensionSectionId(g.dimension));
        if (el && el.getBoundingClientRect().top <= 180) active = g.dimension;
      }
      const next = active ?? QUESTIONS_BY_DIMENSION[0].dimension;
      setActiveDimension((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (raf === 0) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf !== 0) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (toast === null) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ---------------- output ---------------- */

  const buildOutput = useCallback(() => {
    const submission = buildSubmission(setup, answers, notes, {
      includeUnscored: true,
    });
    const result = scoreFull(submission);
    return { submission, result, markdown: buildMarkdown(submission, result) };
  }, [setup, answers, notes]);

  const handleCopy = useCallback(async () => {
    const { markdown } = buildOutput();
    const ok = await copyText(markdown);
    setToast(ok ? 'Report markdown copied.' : 'Copy failed — use Download JSON.');
  }, [buildOutput]);

  const handleDownload = useCallback(() => {
    const { submission, result, markdown } = buildOutput();
    const stem = `dma-${slug(submission.companyName)}-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    downloadFile(
      `${stem}.json`,
      JSON.stringify(buildEnvelope(submission, result), null, 2),
      'application/json'
    );
    downloadFile(`${stem}.md`, markdown, 'text/markdown');
    setToast('JSON and markdown downloaded.');
  }, [buildOutput]);

  const handleSubmit = useCallback(async () => {
    const { submission, result, markdown } = buildOutput();

    if (submission.companyName === '' || submission.opportunityId === '') {
      setSubmitStatus({
        kind: 'error',
        message:
          'Company name and Opportunity id are both required before submitting.',
      });
      setSetupOpen(true);
      return;
    }

    const unscoredWithText = FULL_DMA_QUESTIONS.filter((q) => {
      const a = answers[q.id];
      return answerHasContent(a) && !answerIsScored(a);
    }).length;

    if (totals.complete < TOTAL_QUESTIONS) {
      const lines = [
        `${totals.complete} of ${TOTAL_QUESTIONS} questions are complete.`,
        unscoredWithText > 0
          ? `${unscoredWithText} have notes but no maturity value; they will be recorded as 0 (Fully manual).`
          : '',
        '',
        'Submit the partial assessment anyway?',
      ].filter(Boolean);
      if (!window.confirm(lines.join('\n'))) return;
    }

    if (WORKER_URL === '') {
      setSubmitStatus({
        kind: 'error',
        message:
          'PUBLIC_DMA_WORKER_URL is not set in this build, so there is nowhere to post. Use Copy report or Download JSON.',
      });
      return;
    }
    if (token.trim() === '') {
      setSubmitStatus({
        kind: 'error',
        message:
          'Enter the Worker token in the setup header, or use Copy report / Download JSON instead.',
      });
      setSetupOpen(true);
      return;
    }

    setSubmitStatus({ kind: 'sending' });
    try {
      const res = await fetch(`${WORKER_URL}/api/dma/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify(submission),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`
        );
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      submittedRef.current = true;
      dirtyRef.current = false;
      clearDraft(draftKey(submission.opportunityId));
      setSaveStatus({ kind: 'idle' });
      setSubmitStatus({ kind: 'ok' });
      setFinalReport({ markdown, result });
      window.setTimeout(() => {
        document
          .getElementById('dma-final-report')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setSubmitStatus({
        kind: 'error',
        message: `Could not post to ${WORKER_URL}/api/dma/full — ${detail}. Nothing was lost: the draft is still saved.`,
      });
    }
  }, [answers, buildOutput, token, totals.complete]);

  /* ---------------- render helpers ---------------- */

  const failed = submitStatus.kind === 'error';

  const actions: ReactNode = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitStatus.kind === 'sending'}
        className="w-full rounded-md bg-tenx-gold px-3 py-2 font-heading text-sm font-semibold text-obsidian-void hover:bg-tenx-gold/85 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
      >
        {submitStatus.kind === 'sending' ? 'Submitting…' : 'Submit to Twenty'}
      </button>

      <div
        className={
          'grid grid-cols-2 gap-2 rounded-md ' +
          (failed ? 'border border-amber-400/50 bg-amber-400/5 p-2' : '')
        }
      >
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-md border border-border-interactive px-2 py-2 text-xs font-medium text-vapor-white hover:border-tenx-gold hover:text-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
        >
          Copy report
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md border border-border-interactive px-2 py-2 text-xs font-medium text-vapor-white hover:border-tenx-gold hover:text-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
        >
          Download JSON
        </button>
        {failed && (
          <p className="col-span-2 text-xs leading-snug text-amber-300/90">
            Submit did not go through. Copy or download now — the draft is
            still saved in this browser.
          </p>
        )}
      </div>

      {submitStatus.kind === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1.5 text-xs leading-snug text-red-200"
        >
          {submitStatus.message}
        </p>
      )}
      {submitStatus.kind === 'ok' && (
        <p className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs leading-snug text-emerald-200">
          Submitted. The local draft has been cleared.
        </p>
      )}
    </div>
  );

  const railBody = (
    <SummaryRail
      result={liveResult}
      completed={totals.complete}
      scored={totals.scored}
      totalHours={totals.hours}
      hourlyRateUsd={setup.hourlyRateUsd}
    />
  );

  const savedLabel =
    saveStatus.kind === 'saved'
      ? `Saved ${new Date(saveStatus.at).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}`
      : saveStatus.kind === 'saving'
        ? 'Saving…'
        : saveStatus.kind === 'failed'
          ? 'Autosave failed'
          : 'Nothing to save yet';

  /* ---------------- render ---------------- */

  return (
    <div className="min-h-screen pb-24">
      {/* sticky status bar; on narrow screens the dimension bar rides with it */}
      <div className="sticky top-0 z-40 border-b border-rule bg-obsidian-void/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
          <h1 className="font-heading text-sm font-semibold tracking-tight text-vapor-white">
            Guided DMA
          </h1>
          <span className="truncate text-xs text-text-faint">
            {setup.companyName.trim() || 'No company yet'}
          </span>
          <span className="text-xs tabular-nums text-text-faint">
            {totals.complete}/{TOTAL_QUESTIONS} complete
          </span>
          {liveResult && totals.scored > 0 && (
            <span className="text-xs tabular-nums text-tenx-gold">
              {liveResult.overall}/100 · {liveResult.band.label}
            </span>
          )}
          <span
            className={
              'text-xs ' +
              (saveStatus.kind === 'failed' ? 'text-red-300' : 'text-text-faint')
            }
          >
            {savedLabel}
          </span>
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            aria-expanded={setupOpen}
            className="ml-auto rounded border border-border-interactive px-2 py-1 text-xs text-text-muted hover:border-tenx-gold hover:text-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold"
          >
            {setupOpen ? 'Hide setup' : 'Show setup'}
          </button>
        </div>
        <div className="border-t border-rule lg:hidden">
          <DimensionBar progress={progress} activeId={activeDimension} />
        </div>
        </div>
      </div>

      {setupOpen && (
        <SetupHeader
          setup={setup}
          onPatch={patchSetup}
          fromUrl={urlSetup.fromUrl}
          token={token}
          onTokenChange={handleToken}
          workerUrl={WORKER_URL}
        />
      )}

      {restoreOffer && (
        <div className="border-b border-tenx-gold/30 bg-tenx-gold/10">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
            <p className="min-w-0 flex-1 text-xs leading-snug text-vapor-white">
              <strong className="font-semibold">Saved draft found</strong> for{' '}
              {restoreOffer.draft.setup.companyName.trim() ||
                'this opportunity'}{' '}
              — {countDraftAnswers(restoreOffer.draft)} question
              {countDraftAnswers(restoreOffer.draft) === 1 ? '' : 's'} captured,
              last saved{' '}
              {new Date(restoreOffer.draft.savedAt).toLocaleString('en-GB')}.
            </p>
            <button
              type="button"
              onClick={acceptRestore}
              className="rounded-md bg-tenx-gold px-3 py-1.5 text-xs font-semibold text-obsidian-void hover:bg-tenx-gold/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
            >
              Restore draft
            </button>
            <button
              type="button"
              onClick={ignoreRestore}
              className="rounded-md border border-border-interactive px-3 py-1.5 text-xs text-vapor-white hover:border-vapor-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 lg:grid-cols-[12rem_minmax(0,1fr)_20rem]">
        <div className="hidden lg:block">
          <div className="sticky top-14">
            <DimensionSidebar progress={progress} activeId={activeDimension} />
            <p className="mt-4 text-xs leading-relaxed text-text-faint">
              Alt + ↓ / ↑ moves between questions. Nothing here auto-advances.
            </p>
          </div>
        </div>

        <main className="min-w-0">
          {finalReport && (
            <section
              id="dma-final-report"
              className="mb-6 scroll-mt-32 rounded-lg border border-emerald-400/40 bg-emerald-500/5 p-4"
            >
              <h2 className="font-heading text-base font-semibold text-vapor-white">
                Submitted — {finalReport.result.overall}/100,{' '}
                {finalReport.result.band.label}
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                {finalReport.result.recommendations
                  .map((r, i) => `${i + 1}. ${r.label}`)
                  .join('  ·  ')}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-md bg-tenx-gold px-3 py-1.5 text-xs font-semibold text-obsidian-void hover:bg-tenx-gold/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
                >
                  Copy report markdown
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-md border border-border-interactive px-3 py-1.5 text-xs text-vapor-white hover:border-tenx-gold hover:text-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold"
                >
                  Download JSON
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs tracking-wider text-text-faint uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold">
                  Report preview
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded border border-rule bg-surface-1 p-3 text-xs leading-relaxed whitespace-pre-wrap text-text-muted">
                  {finalReport.markdown}
                </pre>
              </details>
            </section>
          )}

          {/* compact rail for narrow screens */}
          <details className="mb-5 rounded-lg border border-rule bg-surface-1 p-3 lg:hidden">
            <summary className="cursor-pointer font-heading text-sm font-semibold text-vapor-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold">
              Live score and actions
              {liveResult && totals.scored > 0 && (
                <span className="ml-2 text-tenx-gold">
                  {liveResult.overall}/100
                </span>
              )}
            </summary>
            <div className="mt-3 space-y-3">
              {railBody}
              {actions}
            </div>
          </details>

          <div className="space-y-8">
            {QUESTIONS_BY_DIMENSION.map((group) => {
              const p = progress.find((x) => x.dimension === group.dimension)!;
              return (
                <section
                  key={group.dimension}
                  id={dimensionSectionId(group.dimension)}
                  aria-labelledby={`${dimensionSectionId(group.dimension)}-h`}
                  className="scroll-mt-28"
                >
                  <header className="mb-3 border-b border-rule pb-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2
                        id={`${dimensionSectionId(group.dimension)}-h`}
                        className="font-heading text-lg font-semibold tracking-tight text-vapor-white"
                      >
                        {group.label}
                      </h2>
                      <span className="text-xs tabular-nums text-text-faint">
                        {p.complete}/{p.total} complete · weight {group.weight}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-faint">{group.blurb}</p>
                  </header>

                  <div className="space-y-3">
                    {group.questions.map((q) => (
                      <FullDmaQuestion
                        key={q.id}
                        question={q}
                        index={FULL_DMA_QUESTIONS.indexOf(q) + 1}
                        answer={answers[q.id]}
                        onPatch={patchAnswer}
                        onStep={stepTo}
                      />
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-rule bg-white/[0.02] p-3">
                    <AutoGrowTextarea
                      id={`notes-${group.dimension}`}
                      label={`Notes — ${group.label}`}
                      labelClassName={`${LABEL_BASE} mb-1`}
                      value={notes[group.dimension] ?? ''}
                      onChange={(v) => patchNote(group.dimension, v)}
                      minRows={2}
                      hint="Anything that did not fit a question: quotes, constraints, who was in the room."
                    />
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-8 rounded-lg border border-rule bg-surface-1 p-4 lg:hidden">
            {actions}
          </div>
        </main>

        <aside className="hidden lg:block">
          {/* Submit and the two fallbacks stay pinned: they must never be a
              scroll away when the call ends. */}
          <div className="sticky top-14 flex max-h-[calc(100vh-4.5rem)] flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">{railBody}</div>
            <div className="shrink-0 rounded-lg border border-rule bg-surface-1 p-2.5">
              {actions}
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-tenx-gold/40 bg-obsidian-void px-4 py-2 text-sm text-vapor-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default FullDma;
