/**
 * The guided Digital Maturity Assessment: the internal tool a Ten X Africa
 * team member fills in live during the 45-minute call.
 *
 * Two phases. `setup` (SessionSetup) finds or creates the client in the CRM
 * and confirms who is running the call. `interview` walks the six dimensions
 * one at a time, with the live score alongside, and submits to the CRM.
 *
 * Non-negotiables baked into this component:
 *  - Nothing steals focus, nothing auto-advances, nothing animates text.
 *  - Every keystroke is debounced into localStorage, keyed by Opportunity id,
 *    and flushed again when the tab is hidden or closed. A dropped call must
 *    never cost the interview.
 *  - Copy report and Download JSON always work, signed in or not, network or
 *    no network, so a failed POST never costs the call either.
 *  - Sign-in is Cloudflare Access on tenxafrica.co.za; nobody types a
 *    password. The API token is a fallback for other hosts only.
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
  listDrafts,
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
import SessionSetup from './full/SessionSetup';
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
import {
  accessDisplayName,
  explainApiError,
  internalApiBase,
  isProductionHost,
  submitFull,
  whoami,
  type Identity,
} from './full/api';

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

type Phase = 'setup' | 'interview';

const BTN_PRIMARY =
  'inline-flex min-h-11 w-full items-center justify-center rounded-[2px] bg-tenx-gold px-4 font-heading text-[0.75rem] font-semibold tracking-[0.14em] uppercase text-obsidian-void transition-colors duration-150 hover:bg-gold-hover disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold';
const BTN_SECONDARY =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-border-interactive px-3 text-[0.8125rem] font-medium text-vapor-white transition-colors duration-150 hover:border-tenx-gold hover:text-tenx-gold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold';

export function FullDma() {
  const urlSetup = useMemo(readUrlSetup, []);

  const [phase, setPhase] = useState<Phase>('setup');
  const [setup, setSetup] = useState<SetupState>(() => ({
    ...DEFAULT_SETUP,
    ...urlSetup.values,
  }));
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [notes, setNotes] = useState<Partial<Record<DimensionId, string>>>({});
  const [token, setToken] = useState('');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [drafts, setDrafts] = useState<{ key: string; draft: DraftState }[]>([]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' });
  const [liveResult, setLiveResult] = useState<ScoreResult | null>(null);
  const [finalReport, setFinalReport] = useState<{ markdown: string; result: ScoreResult } | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionId>(QUESTIONS_BY_DIMENSION[0]!.dimension);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const backedUpKeysRef = useRef<Set<string>>(new Set());
  const latestRef = useRef({ setup, answers, notes });
  latestRef.current = { setup, answers, notes };

  /* ---------------- sign-in and token ---------------- */

  useEffect(() => {
    setToken(readToken());
    setDrafts(listDrafts());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIdentityLoading(true);
    (async () => {
      let who: Identity | null = null;
      try {
        const res = await whoami(token || undefined);
        who = { email: res.email, name: res.name, via: res.via };
      } catch {
        who = null;
      }
      if (who && who.via === 'access' && !who.name) {
        const extra = await accessDisplayName();
        if (extra?.name) who = { ...who, name: extra.name };
      }
      if (!cancelled) {
        setIdentity(who);
        setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleToken = useCallback((v: string) => {
    setToken(v);
    writeToken(v);
  }, []);

  /* ---------------- patching ---------------- */

  const patchAnswer = useCallback((questionId: string, patch: Partial<AnswerDraft>) => {
    dirtyRef.current = true;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? emptyAnswer()), ...patch },
    }));
  }, []);

  const patchNote = useCallback((dimension: DimensionId, value: string) => {
    dirtyRef.current = true;
    setNotes((prev) => ({ ...prev, [dimension]: value }));
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

  /* ---------------- starting and resuming ---------------- */

  const enterInterview = useCallback(() => {
    setPhase('interview');
    setActiveDimension(QUESTIONS_BY_DIMENSION[0]!.dimension);
    setSubmitStatus({ kind: 'idle' });
    setFinalReport(null);
    submittedRef.current = false;
    window.scrollTo({ top: 0 });
  }, []);

  const startSession = useCallback(
    (s: SetupState) => {
      // A draft for this opportunity from an earlier attempt is restored
      // automatically: the interviewer chose the same client on purpose.
      const existing = readDraft(draftKey(s.opportunityId));
      if (existing && draftIsWorthRestoring(existing)) {
        backedUpKeysRef.current.add(draftKey(s.opportunityId));
        setSetup({ ...existing.setup, ...s, hourlyRateUsd: s.hourlyRateUsd || existing.setup.hourlyRateUsd });
        setAnswers(existing.answers);
        setNotes(existing.notes);
        setToast(`Restored ${countDraftAnswers(existing)} saved answers for this client.`);
      } else {
        setSetup(s);
        setAnswers({});
        setNotes({});
      }
      dirtyRef.current = true;
      enterInterview();
    },
    [enterInterview]
  );

  const resumeDraft = useCallback(
    (key: string) => {
      const d = readDraft(key);
      if (!d) return;
      backedUpKeysRef.current.add(key);
      setSetup({ ...DEFAULT_SETUP, ...d.setup });
      setAnswers(d.answers);
      setNotes(d.notes);
      dirtyRef.current = true;
      setToast('Draft restored.');
      enterInterview();
    },
    [enterInterview]
  );

  const backToSetup = useCallback(() => {
    persist();
    setDrafts(listDrafts());
    setPhase('setup');
    window.scrollTo({ top: 0 });
  }, [persist]);

  /* ---------------- derived ---------------- */

  const totals = useMemo(() => {
    let hours = 0;
    let complete = 0;
    let scored = 0;
    for (const q of FULL_DMA_QUESTIONS) {
      const a = answers[q.id];
      if (!a) continue;
      if (a.hoursPerWeek) hours += a.hoursPerWeek;
      if (answerIsComplete(a)) complete += 1;
      if (answerIsScored(a)) scored += 1;
    }
    return { hours, complete, scored };
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
        return { dimension: g.dimension, label: g.label, complete, total: g.questions.length, unscored };
      }),
    [answers]
  );

  /* live score, debounced */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const submission = buildSubmission(setup, answers, notes, { includeUnscored: false });
      setLiveResult(submission.answers.length > 0 ? scoreFull(submission) : null);
    }, SCORE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [setup, answers, notes]);

  useEffect(() => {
    if (toast === null) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ---------------- navigation between dimensions ---------------- */

  const activeIndex = QUESTIONS_BY_DIMENSION.findIndex((g) => g.dimension === activeDimension);

  const goTo = useCallback((id: DimensionId) => {
    setActiveDimension(id);
    window.setTimeout(() => {
      document.getElementById(dimensionSectionId(id))?.scrollIntoView({ block: 'start' });
    }, 0);
  }, []);

  const stepTo = useCallback(
    (questionId: string, direction: 1 | -1) => {
      const i = FULL_DMA_QUESTIONS.findIndex((q) => q.id === questionId);
      const next = FULL_DMA_QUESTIONS[i + direction];
      if (!next) return;
      if (!showAll && next.dimension !== activeDimension) setActiveDimension(next.dimension);
      window.setTimeout(() => {
        document.getElementById(questionCardId(next.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const field = document.getElementById(questionFieldId(next.id, 'current'));
        if (field instanceof HTMLTextAreaElement) field.focus({ preventScroll: true });
      }, 0);
    },
    [activeDimension, showAll]
  );

  /* ---------------- output ---------------- */

  const buildOutput = useCallback(() => {
    const submission = buildSubmission(setup, answers, notes, { includeUnscored: true });
    const result = scoreFull(submission);
    return { submission, result, markdown: buildMarkdown(submission, result) };
  }, [setup, answers, notes]);

  const handleCopy = useCallback(async () => {
    const { markdown } = buildOutput();
    const ok = await copyText(markdown);
    setToast(ok ? 'Report copied.' : 'Copy failed. Use Download JSON.');
  }, [buildOutput]);

  const handleDownload = useCallback(() => {
    const { submission, result, markdown } = buildOutput();
    const stem = `dma-${slug(submission.companyName)}-${new Date().toISOString().slice(0, 10)}`;
    downloadFile(`${stem}.json`, JSON.stringify(buildEnvelope(submission, result), null, 2), 'application/json');
    downloadFile(`${stem}.md`, markdown, 'text/markdown');
    setToast('JSON and markdown downloaded.');
  }, [buildOutput]);

  const handleSubmit = useCallback(async () => {
    const { submission, result, markdown } = buildOutput();

    if (submission.companyName === '' || submission.opportunityId === '') {
      setSubmitStatus({ kind: 'error', message: 'The session has no client attached. Go back to setup and choose one.' });
      return;
    }
    if (submission.interviewer === '') {
      setSubmitStatus({ kind: 'error', message: 'The interviewer’s name is missing. Go back to setup and add it.' });
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

    if (internalApiBase() === '' && !isProductionHost()) {
      setSubmitStatus({ kind: 'error', message: 'This build has no API address, so there is nowhere to post. Use Copy report or Download JSON.' });
      return;
    }

    setSubmitStatus({ kind: 'sending' });
    try {
      await submitFull(submission, token.trim() || undefined);
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
        document.getElementById('dma-final-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      setSubmitStatus({ kind: 'error', message: `${explainApiError(err)} The draft is still saved in this browser.` });
    }
  }, [answers, buildOutput, token, totals.complete]);

  /* ---------------- render: setup ---------------- */

  if (phase === 'setup') {
    return (
      <>
        <SessionSetup
          identity={identity}
          identityLoading={identityLoading}
          token={token}
          onTokenChange={handleToken}
          showTokenField={!isProductionHost()}
          initial={setup}
          fromUrl={urlSetup.fromUrl}
          drafts={drafts}
          onResumeDraft={resumeDraft}
          onStart={startSession}
        />
        {toast && <Toast>{toast}</Toast>}
      </>
    );
  }

  /* ---------------- render: interview ---------------- */

  const failed = submitStatus.kind === 'error';

  const actions: ReactNode = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitStatus.kind === 'sending'}
        className={BTN_PRIMARY}
      >
        {submitStatus.kind === 'sending' ? 'Submitting…' : 'Submit to the CRM'}
      </button>

      <div className={'grid grid-cols-2 gap-2 rounded-[2px] ' + (failed ? 'border border-gold-hover/50 p-2' : '')}>
        <button type="button" onClick={() => void handleCopy()} className={BTN_SECONDARY}>
          Copy report
        </button>
        <button type="button" onClick={handleDownload} className={BTN_SECONDARY}>
          Download JSON
        </button>
        {failed && (
          <p className="col-span-2 text-[0.8125rem] leading-snug text-gold-hover">
            Submit did not go through. Copy or download now; the draft is still saved in this browser.
          </p>
        )}
      </div>

      {submitStatus.kind === 'error' && (
        <p role="alert" className="border-l-2 border-signal-bad pl-3 text-[0.8125rem] leading-snug text-signal-bad">
          {submitStatus.message}
        </p>
      )}
      {submitStatus.kind === 'ok' && (
        <p className="border-l-2 border-signal-good pl-3 text-[0.8125rem] leading-snug text-signal-good">
          Submitted. The note is on the opportunity and the local draft has been cleared.
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
      ? `Saved ${new Date(saveStatus.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      : saveStatus.kind === 'saving'
        ? 'Saving…'
        : saveStatus.kind === 'failed'
          ? 'Autosave failed'
          : 'Nothing to save yet';

  const groups = showAll ? QUESTIONS_BY_DIMENSION : QUESTIONS_BY_DIMENSION.filter((g) => g.dimension === activeDimension);

  return (
    <div className="min-h-screen pb-24">
      {/* sticky status bar; on narrow screens the dimension bar rides with it */}
      <div className="sticky top-0 z-40 border-b border-rule bg-obsidian-void">
        <div className="mx-auto max-w-[1600px] px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
            <h1 className="font-heading text-[0.9375rem] font-semibold tracking-tight text-vapor-white">
              Guided assessment
            </h1>
            <span className="truncate text-[0.8125rem] text-text-muted">
              {setup.companyName.trim() || 'No company yet'}
            </span>
            <span className="hidden text-[0.8125rem] text-text-faint sm:inline">
              with {setup.interviewer.trim() || 'unnamed interviewer'}
            </span>
            <span className="text-[0.8125rem] tabular-nums text-text-faint">
              {totals.complete}/{TOTAL_QUESTIONS} complete
            </span>
            {liveResult && totals.scored > 0 && (
              <span className="text-[0.8125rem] tabular-nums text-tenx-gold">
                {liveResult.overall}/100 &middot; {liveResult.band.label}
              </span>
            )}
            <span className={'text-[0.8125rem] ' + (saveStatus.kind === 'failed' ? 'text-signal-bad' : 'text-text-faint')}>
              {savedLabel}
            </span>
            <button type="button" onClick={backToSetup} className={`${BTN_SECONDARY} ml-auto min-h-9`}>
              Change client or interviewer
            </button>
          </div>
          <div className="border-t border-rule lg:hidden">
            <DimensionBar progress={progress} activeId={activeDimension} onSelect={goTo} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 lg:grid-cols-[13rem_minmax(0,1fr)_20rem]">
        <div className="hidden lg:block">
          <div className="sticky top-14 space-y-4">
            <DimensionSidebar progress={progress} activeId={activeDimension} onSelect={goTo} />
            <label className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4 accent-tenx-gold"
              />
              Show all six areas at once
            </label>
            <p className="text-[0.8125rem] leading-relaxed text-text-faint">
              Alt + &darr; / &uarr; moves between questions. Nothing here auto-advances.
            </p>
          </div>
        </div>

        <main className="min-w-0">
          {finalReport && (
            <section
              id="dma-final-report"
              className="mb-6 scroll-mt-32 rounded-[2px] border border-signal-good/50 bg-surface-1 p-4"
            >
              <h2 className="font-heading text-[1.125rem] font-semibold text-vapor-white">
                Submitted: {finalReport.result.overall}/100, {finalReport.result.band.label}
              </h2>
              <p className="mt-1 text-[0.8125rem] text-text-muted">
                {finalReport.result.recommendations.map((r, i) => `${i + 1}. ${r.label}`).join('  ·  ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleCopy()} className={BTN_SECONDARY}>
                  Copy report
                </button>
                <button type="button" onClick={handleDownload} className={BTN_SECONDARY}>
                  Download JSON
                </button>
                <button type="button" onClick={backToSetup} className={BTN_SECONDARY}>
                  Start another assessment
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.75rem] tracking-[0.14em] text-text-faint uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold">
                  Report preview
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-[2px] border border-rule bg-surface-2 p-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-text-muted">
                  {finalReport.markdown}
                </pre>
              </details>
            </section>
          )}

          {/* compact rail for narrow screens */}
          <details className="mb-5 rounded-[2px] border border-rule bg-surface-1 p-3 lg:hidden">
            <summary className="cursor-pointer font-heading text-[0.9375rem] font-semibold text-vapor-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold">
              Live score and actions
              {liveResult && totals.scored > 0 && <span className="ml-2 text-tenx-gold">{liveResult.overall}/100</span>}
            </summary>
            <div className="mt-3 space-y-3">
              {railBody}
              {actions}
            </div>
          </details>

          <div className="space-y-8">
            {groups.map((group) => {
              const p = progress.find((x) => x.dimension === group.dimension)!;
              const idx = QUESTIONS_BY_DIMENSION.indexOf(group);
              return (
                <section
                  key={group.dimension}
                  id={dimensionSectionId(group.dimension)}
                  aria-labelledby={`${dimensionSectionId(group.dimension)}-h`}
                  className="scroll-mt-28"
                >
                  <header className="mb-3 border-b border-rule pb-2">
                    <p className="text-[0.75rem] tracking-[0.14em] text-text-faint uppercase">
                      Area {idx + 1} of {QUESTIONS_BY_DIMENSION.length}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2
                        id={`${dimensionSectionId(group.dimension)}-h`}
                        className="font-heading text-[1.25rem] font-semibold tracking-tight text-vapor-white"
                      >
                        {group.label}
                      </h2>
                      <span className="text-[0.8125rem] tabular-nums text-text-faint">
                        {p.complete}/{p.total} complete &middot; weight {group.weight}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.875rem] text-text-muted">{group.blurb}</p>
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

                  <div className="mt-3 rounded-[2px] border border-rule bg-surface-1 p-3">
                    <AutoGrowTextarea
                      id={`notes-${group.dimension}`}
                      label={`Notes on ${group.label.toLowerCase()}`}
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

          {!showAll && (
            <nav className="mt-6 flex items-center justify-between gap-3 border-t border-rule pt-4" aria-label="Areas">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={activeIndex <= 0}
                onClick={() => goTo(QUESTIONS_BY_DIMENSION[activeIndex - 1]!.dimension)}
              >
                &larr; {activeIndex > 0 ? QUESTIONS_BY_DIMENSION[activeIndex - 1]!.label : 'Start'}
              </button>
              {activeIndex < QUESTIONS_BY_DIMENSION.length - 1 ? (
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => goTo(QUESTIONS_BY_DIMENSION[activeIndex + 1]!.dimension)}
                >
                  {QUESTIONS_BY_DIMENSION[activeIndex + 1]!.label} &rarr;
                </button>
              ) : (
                <span className="text-[0.8125rem] text-text-faint">Last area. Submit from the panel when you are done.</span>
              )}
            </nav>
          )}

          <div className="mt-8 rounded-[2px] border border-rule bg-surface-1 p-4 lg:hidden">{actions}</div>
        </main>

        <aside className="hidden lg:block">
          {/* Submit and the two fallbacks stay pinned: they must never be a
              scroll away when the call ends. */}
          <div className="sticky top-14 flex max-h-[calc(100vh-4.5rem)] flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">{railBody}</div>
            <div className="shrink-0 rounded-[2px] border border-rule bg-surface-1 p-2.5">{actions}</div>
          </div>
        </aside>
      </div>

      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[2px] border border-tenx-gold/60 bg-obsidian-void px-4 py-2 text-[0.9375rem] text-vapor-white"
    >
      {children}
    </div>
  );
}

export default FullDma;
