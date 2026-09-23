import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Turnstile from 'react-turnstile';

import { SELF_SERVE_QUESTIONS, DIMENSION_META } from '../../../shared/dma/questions';
import { scoreSelfServe, selfServeIsComplete } from '../../../shared/dma/scoring';
import type {
  ScoreResult,
  SelfServeContact,
  SelfServeSubmission,
} from '../../../shared/dma/types';

import { ScoreDial } from './ScoreDial';
import { DimensionBars } from './DimensionBars';
import { COUNTRIES, PRIORITY_COUNTRIES } from './countries';
import { SIZE_OPTIONS, SECTOR_OPTIONS } from './formOptions';
import {
  HASH_PREFIX,
  decodeAnswers,
  dimensionLabel,
  emailLooksValid,
  encodeAnswers,
  isFreeEmail,
  joinList,
  normaliseWebsite,
  usePrefersReducedMotion,
  websiteLooksWrong,
  DMA_WORKER_URL,
  TURNSTILE_SITE_KEY,
} from './util';

const BOOKING_URL =
  'https://bookings.cloud.microsoft/book/DiscoveryCall@tenxafrica.co.za/';
const CONTACT_EMAIL = 'hello@tenxafrica.co.za';
const TOTAL = SELF_SERVE_QUESTIONS.length;
const REQUEST_TIMEOUT_MS = 10_000;

const DIMENSION_BY_ID = new Map(DIMENSION_META.map((d) => [d.id, d]));

type Phase = 'intro' | 'questions' | 'contact' | 'result';
type SaveState = 'idle' | 'sending' | 'saved' | 'failed' | 'restored';

interface ContactState {
  companyName: string;
  website: string;
  country: string;
  size: SelfServeContact['size'] | '';
  sector: string;
  fullName: string;
  email: string;
  biggestTimeSink: string;
  consent: boolean;
}

const EMPTY_CONTACT: ContactState = {
  companyName: '',
  website: '',
  country: '',
  size: '',
  sector: '',
  fullName: '',
  email: '',
  biggestTimeSink: '',
  consent: false,
};

/* ------------------------------------------------------------------ */
/* Shared class strings                                                */
/* ------------------------------------------------------------------ */

const EYEBROW =
  'font-sans text-xs font-medium tracking-[0.22em] uppercase text-tenx-gold';
const LEDE = 'text-[1.0625rem] leading-relaxed text-vapor-white sm:text-lg';
const FIELD =
  'dma-field w-full rounded-[2px] border border-border-interactive bg-surface-1 px-3.5 py-3 text-base text-vapor-white placeholder:text-text-faint';
const LABEL = 'block font-sans text-sm font-medium text-vapor-white';
const ERROR_TEXT = 'mt-1.5 font-sans text-sm text-[#ffb4a2]';
const SECTION_HEADING =
  'font-heading text-[1.35rem] font-semibold leading-tight text-vapor-white sm:text-2xl';

export const SelfServeAssessment: React.FC = () => {
  const reduced = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusIndex, setFocusIndex] = useState(0);

  const [localResult, setLocalResult] = useState<ScoreResult | null>(null);
  const [serverResult, setServerResult] = useState<ScoreResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [emailNudges, setEmailNudges] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileBroken, setTurnstileBroken] = useState(false);

  const [live, setLive] = useState('');

  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const advanceTimer = useRef<number | undefined>(undefined);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const hasStarted = useRef(false);
  /**
   * Focus only follows the step when the person is driving from the
   * keyboard. A pointer user who lands on a freshly focused answer card
   * reads the ring as "this one is already picked", which it is not.
   */
  const keyboardNav = useRef(false);

  const question = SELF_SERVE_QUESTIONS[questionIndex];
  const result = serverResult ?? localResult;

  /* ---------------------------------------------------------------- */
  /* Rehydrate from the URL hash                                       */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const rehydrate = () => {
      const decoded = decodeAnswers(window.location.hash);
      if (!decoded || !selfServeIsComplete(decoded)) return;
      hasStarted.current = true;
      setAnswers(decoded);
      setLocalResult(scoreSelfServe(decoded));
      setSaveState('restored');
      setPhase('result');
    };
    rehydrate();
    // A same-document hash change never remounts us, so catch it too.
    window.addEventListener('hashchange', rehydrate);
    return () => window.removeEventListener('hashchange', rehydrate);
  }, []);

  /* Score locally as soon as the last question lands. */
  useEffect(() => {
    if (!selfServeIsComplete(answers)) return;
    setLocalResult((current) => current ?? scoreSelfServe(answers));
  }, [answers]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  /* ---------------------------------------------------------------- */
  /* Step transitions                                                  */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (phase !== 'questions') return;
    const selected = question.options.findIndex(
      (o) => o.value === answers[question.id]
    );
    const next = selected >= 0 ? selected : 0;
    setFocusIndex(next);
    setLive(`Question ${questionIndex + 1} of ${TOTAL}`);

    if (hasStarted.current) {
      if (keyboardNav.current) {
        window.requestAnimationFrame(() => {
          optionRefs.current[next]?.focus({ preventScroll: true });
        });
      }
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
    // Answers deliberately excluded: re-running on every pick would steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex]);

  useEffect(() => {
    if (phase !== 'contact') return;
    setLive('Last step. A few details so the result is yours.');
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [phase, reduced]);

  useEffect(() => {
    if (phase !== 'result' || !result) return;
    setLive(
      `Your result is ready. ${result.overall} out of 100, ${result.band.label}.`
    );
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => resultRef.current?.focus());
    try {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${HASH_PREFIX}${encodeAnswers(answers)}`
      );
    } catch {
      /* Hash is a convenience; never let it break the result. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  /* ---------------------------------------------------------------- */
  /* Answering                                                         */
  /* ---------------------------------------------------------------- */

  const selectOption = useCallback(
    (value: string) => {
      window.clearTimeout(advanceTimer.current);
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
      const isLast = questionIndex === TOTAL - 1;
      advanceTimer.current = window.setTimeout(
        () => {
          if (isLast) setPhase('contact');
          else setQuestionIndex((i) => i + 1);
        },
        reduced ? 180 : 420
      );
    },
    [question.id, questionIndex, reduced]
  );

  const onOptionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      const last = question.options.length - 1;
      let next: number | null = null;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          next = index === last ? 0 : index + 1;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          next = index === 0 ? last : index - 1;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = last;
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          selectOption(question.options[index].value);
          return;
        default:
          return;
      }

      event.preventDefault();
      setFocusIndex(next);
      optionRefs.current[next]?.focus();
    },
    [question.options, selectOption]
  );

  const goBack = useCallback(() => {
    window.clearTimeout(advanceTimer.current);
    if (phase === 'contact') {
      setPhase('questions');
      setQuestionIndex(TOTAL - 1);
      return;
    }
    if (questionIndex === 0) {
      setPhase('intro');
      return;
    }
    setQuestionIndex((i) => i - 1);
  }, [phase, questionIndex]);

  const start = useCallback(() => {
    hasStarted.current = true;
    setPhase('questions');
    setQuestionIndex(0);
  }, []);

  const startAgain = useCallback(() => {
    window.clearTimeout(advanceTimer.current);
    hasStarted.current = false;
    setAnswers({});
    setLocalResult(null);
    setServerResult(null);
    setSaveState('idle');
    setContact(EMPTY_CONTACT);
    setErrors({});
    setEmailNudges(0);
    setQuestionIndex(0);
    setPhase('intro');
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      /* no-op */
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  /* ---------------------------------------------------------------- */
  /* Contact step                                                      */
  /* ---------------------------------------------------------------- */

  const setField = useCallback(
    <K extends keyof ContactState>(key: K, value: ContactState[K]) => {
      setContact((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  const validate = useCallback((): boolean => {
    const next: Record<string, string | undefined> = {};

    if (!contact.companyName.trim()) {
      next.companyName = 'We need the company name.';
    }
    if (websiteLooksWrong(contact.website)) {
      next.website = 'That does not look like a web address. Try acme.com.';
    }
    if (!contact.country) next.country = 'Pick a country.';
    if (!contact.size) next.size = 'Pick a size.';
    if (!contact.fullName.trim()) next.fullName = 'We need your name.';

    if (!contact.email.trim()) {
      next.email = 'We need an email address to send this to.';
    } else if (!emailLooksValid(contact.email)) {
      next.email = 'That email address does not look right.';
    } else if (isFreeEmail(contact.email) && emailNudges < 1) {
      next.email =
        'A work address helps us look your business up before we speak. If this is the one you use, submit again and we will take it.';
      setEmailNudges((n) => n + 1);
    }

    if (!contact.biggestTimeSink.trim()) {
      next.biggestTimeSink = 'One line is enough — this is the useful bit.';
    }
    if (!turnstileToken && !turnstileBroken) {
      next.turnstile = 'Give the security check a moment to finish.';
    }

    setErrors(next);
    return Object.values(next).every((v) => !v);
  }, [contact, emailNudges, turnstileToken, turnstileBroken]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (saveState === 'sending') return;
      if (!validate()) {
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>('[data-dma-invalid="true"]')
            ?.focus();
        });
        return;
      }

      const payloadContact: SelfServeContact = {
        companyName: contact.companyName.trim(),
        country: contact.country,
        size: contact.size as SelfServeContact['size'],
        fullName: contact.fullName.trim(),
        email: contact.email.trim(),
        biggestTimeSink: contact.biggestTimeSink.trim(),
        consent: contact.consent,
      };
      const website = normaliseWebsite(contact.website);
      if (website) payloadContact.website = website;
      if (contact.sector) payloadContact.sector = contact.sector;

      // Score locally first. Whatever the network does next, this is what
      // the person sees.
      const local = scoreSelfServe(answers, payloadContact);
      setLocalResult(local);
      setSaveState('sending');

      const submission: SelfServeSubmission = {
        version: 'dma-selfserve-1',
        answers,
        contact: payloadContact,
        turnstileToken,
        submittedAt: new Date().toISOString(),
      };

      const base = DMA_WORKER_URL || undefined;
      if (!base) {
        setSaveState('failed');
        setPhase('result');
        return;
      }

      const controller = new AbortController();
      const timer = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      try {
        const response = await fetch(
          `${base.replace(/\/$/, '')}/api/dma/self-serve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission),
            signal: controller.signal,
          }
        );
        const data = (await response.json()) as {
          ok?: boolean;
          result?: ScoreResult;
        };
        if (response.ok && data.ok && data.result) {
          setServerResult(data.result);
          setSaveState('saved');
        } else {
          setSaveState('failed');
        }
      } catch {
        setSaveState('failed');
      } finally {
        window.clearTimeout(timer);
        setPhase('result');
      }
    },
    [answers, contact, saveState, turnstileToken, validate]
  );

  /* ---------------------------------------------------------------- */
  /* Derived                                                           */
  /* ---------------------------------------------------------------- */

  /* The contact step is the thirteenth screen, so the bar never sits at
     zero on question one and never hits full before the end. */
  const progress =
    phase === 'contact' || phase === 'result'
      ? 100
      : Math.round(((questionIndex + 1) / (TOTAL + 1)) * 100);

  const mailtoHref = useMemo(() => {
    if (!result) return `mailto:${CONTACT_EMAIL}`;
    const lines = [
      `Company: ${contact.companyName || '(not given)'}`,
      `Score: ${result.overall}/100 (${result.band.label})`,
      '',
      'Areas:',
      ...result.dimensions.map((d) => `- ${d.label}: ${d.score}/100`),
      '',
      'Suggested first builds:',
      ...result.recommendations.map((r) => `- ${r.label}`),
      '',
      `Biggest weekly time-sink: ${contact.biggestTimeSink || '(not given)'}`,
      '',
      `Result link: ${
        typeof window === 'undefined' ? '' : window.location.href
      }`,
    ];
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      `Digital Maturity Score — ${contact.companyName || 'my business'}`
    )}&body=${encodeURIComponent(lines.join('\n'))}`;
  }, [result, contact.companyName, contact.biggestTimeSink]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div
      className="dma-shell mx-auto w-full max-w-[44rem] px-5 pt-10 pb-24 sm:px-8 sm:pt-16"
      onPointerDownCapture={() => {
        keyboardNav.current = false;
      }}
      onKeyDownCapture={(event) => {
        if (
          event.key === 'Tab' ||
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key.startsWith('Arrow')
        ) {
          keyboardNav.current = true;
        }
      }}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>

      {phase === 'intro' && <Intro onStart={start} />}

      {phase === 'questions' && (
        <section aria-labelledby="dma-question-prompt">
          <Progress
            value={progress}
            left={DIMENSION_BY_ID.get(question.dimension)?.label ?? ''}
            right={`${questionIndex + 1} / ${TOTAL}`}
          />

          <fieldset className="m-0 mt-8 border-0 p-0">
            <legend
              id="dma-question-prompt"
              className="block w-full p-0 font-heading text-[clamp(1.375rem,5.6vw,1.875rem)] leading-[1.25] font-semibold text-vapor-white"
            >
              {question.prompt}
            </legend>
            {question.help && (
              <p
                id="dma-question-help"
                className="mt-3 font-sans text-[0.9375rem] leading-relaxed text-text-muted"
              >
                {question.help}
              </p>
            )}

            <div
              role="radiogroup"
              aria-labelledby="dma-question-prompt"
              aria-describedby={question.help ? 'dma-question-help' : undefined}
              className="mt-7 flex flex-col gap-2.5"
            >
              {question.options.map((option, index) => {
                const checked = answers[question.id] === option.value;
                return (
                  <div
                    key={option.value}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    role="radio"
                    aria-checked={checked}
                    tabIndex={index === focusIndex ? 0 : -1}
                    onClick={() => selectOption(option.value)}
                    onKeyDown={(event) => onOptionKeyDown(event, index)}
                    className="dma-option flex min-h-[56px] cursor-pointer items-center gap-3.5 rounded-[2px] border border-rule bg-white/[0.025] px-4 py-3 text-left transition-colors duration-150 hover:border-tenx-gold/50 hover:bg-white/[0.055]"
                  >
                    <span className="dma-marker" aria-hidden="true" />
                    <span className="font-sans text-[0.9375rem] leading-snug text-vapor-white sm:text-base">
                      {option.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <BackButton onClick={goBack} />
        </section>
      )}

      {phase === 'contact' && (
        <section aria-labelledby="dma-contact-heading">
          <Progress value={100} left="Last step" right={`${TOTAL} / ${TOTAL}`} />

          <h1
            id="dma-contact-heading"
            className="mt-8 font-heading text-[clamp(1.5rem,6vw,2.125rem)] leading-[1.2] font-bold text-vapor-white"
          >
            Your score is ready.
          </h1>
          <p className={`mt-4 ${LEDE}`}>
            Tell us who it belongs to and we will put your name on it. Nothing
            here changes the number — it is already worked out.
          </p>

          <form className="mt-10" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">
              <Field
                id="dma-company"
                label="Company name"
                error={errors.companyName}
              >
                {(props) => (
                  <input
                    {...props}
                    type="text"
                    autoComplete="organization"
                    className={FIELD}
                    value={contact.companyName}
                    onChange={(e) => setField('companyName', e.target.value)}
                  />
                )}
              </Field>

              <Field
                id="dma-website"
                label="Website"
                optional
                hint="A bare domain is fine."
                error={errors.website}
              >
                {(props) => (
                  <input
                    {...props}
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="acme.com"
                    className={FIELD}
                    value={contact.website}
                    onChange={(e) => setField('website', e.target.value)}
                  />
                )}
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="dma-country" label="Country" error={errors.country}>
                  {(props) => (
                    <select
                      {...props}
                      autoComplete="country"
                      className={`${FIELD} dma-select`}
                      value={contact.country}
                      onChange={(e) => setField('country', e.target.value)}
                    >
                      <option value="">Select a country</option>
                      <optgroup label="Where we work most">
                        {PRIORITY_COUNTRIES.map((c) => (
                          <option key={`p-${c.code}`} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="All countries">
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </Field>

                <Field id="dma-size" label="How many people" error={errors.size}>
                  {(props) => (
                    <select
                      {...props}
                      className={`${FIELD} dma-select`}
                      value={contact.size}
                      onChange={(e) =>
                        setField(
                          'size',
                          e.target.value as ContactState['size']
                        )
                      }
                    >
                      <option value="">Select a size</option>
                      {SIZE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <Field id="dma-sector" label="Sector" optional>
                {(props) => (
                  <select
                    {...props}
                    className={`${FIELD} dma-select`}
                    value={contact.sector}
                    onChange={(e) => setField('sector', e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    {SECTOR_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field id="dma-name" label="Your name" error={errors.fullName}>
                {(props) => (
                  <input
                    {...props}
                    type="text"
                    autoComplete="name"
                    className={FIELD}
                    value={contact.fullName}
                    onChange={(e) => setField('fullName', e.target.value)}
                  />
                )}
              </Field>

              <Field id="dma-email" label="Work email" error={errors.email}>
                {(props) => (
                  <input
                    {...props}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className={FIELD}
                    value={contact.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                )}
              </Field>

              <Field
                id="dma-timesink"
                label="Biggest weekly time-sink"
                hint="The thing you would hand to someone else tomorrow if you could."
                error={errors.biggestTimeSink}
              >
                {(props) => (
                  <textarea
                    {...props}
                    rows={3}
                    className={`${FIELD} resize-none`}
                    value={contact.biggestTimeSink}
                    onChange={(e) =>
                      setField('biggestTimeSink', e.target.value)
                    }
                  />
                )}
              </Field>
            </div>

            <div className="mt-8 border-t border-rule pt-6">
              <label
                htmlFor="dma-consent"
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  id="dma-consent"
                  type="checkbox"
                  className="dma-checkbox mt-0.5 h-5 w-5 shrink-0"
                  checked={contact.consent}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={
                    errors.consent ? 'dma-consent-error' : 'dma-consent-note'
                  }
                  data-dma-invalid={errors.consent ? 'true' : undefined}
                  onChange={(e) => setField('consent', e.target.checked)}
                />
                <span className="font-sans text-[0.9375rem] leading-snug text-vapor-white">
                  Ten X Africa may email me about my results.{' '}
                  <span className="text-text-muted">Optional. You get your score either way.</span>
                </span>
              </label>
              {errors.consent && (
                <p id="dma-consent-error" role="alert" className={ERROR_TEXT}>
                  {errors.consent}
                </p>
              )}
              <p
                id="dma-consent-note"
                className="mt-3 font-sans text-[0.8125rem] leading-relaxed text-text-muted"
              >
                Ten X Africa (Pty) Ltd, Johannesburg, South Africa. You can ask us
                to stop at any time and we will. See our{' '}
                <a
                  href="/privacy"
                  className="dma-inline-link text-tenx-gold underline underline-offset-2"
                >
                  privacy notice
                </a>
                .
              </p>
            </div>

            <div className="mt-7 flex flex-col items-start gap-2">
              <Turnstile
                sitekey={TURNSTILE_SITE_KEY}
                theme="dark"
                onVerify={(token) => {
                  setTurnstileToken(token);
                  setErrors((prev) => ({ ...prev, turnstile: undefined }));
                }}
                onError={() => setTurnstileBroken(true)}
                onTimeout={() => setTurnstileBroken(true)}
                onExpire={() => setTurnstileToken('')}
              />
              {errors.turnstile && (
                <p role="alert" className={ERROR_TEXT}>
                  {errors.turnstile}
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <button
                type="submit"
                className="dma-button-primary"
                disabled={saveState === 'sending'}
                aria-busy={saveState === 'sending'}
              >
                {saveState === 'sending' ? 'Working…' : 'Show me my score'}
              </button>
              <button
                type="button"
                onClick={goBack}
                className="dma-button-quiet"
              >
                Back to the last question
              </button>
            </div>
          </form>
        </section>
      )}

      {phase === 'result' && result && (
        <Result
          result={result}
          companyName={contact.companyName}
          saveState={saveState}
          mailtoHref={mailtoHref}
          onStartAgain={startAgain}
          containerRef={resultRef}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */

const Intro: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <section>
    <p className={EYEBROW}>Digital Maturity Assessment</p>
    <h1 className="mt-5 font-heading text-[clamp(2rem,8.5vw,3.25rem)] leading-[1.08] font-bold tracking-[-0.02em] text-vapor-white">
      Where does the week actually go?
    </h1>
    <p className={`mt-6 ${LEDE}`}>
      Twelve questions about how work moves through your business — enquiries,
      quotes, jobs, invoices, records. At the end you get a score out of 100, a
      breakdown across six areas, and the two things worth building first.
    </p>

    <ul className="mt-9 flex flex-col gap-0 border-y border-rule">
      {[
        ['Twelve questions', 'One per screen. No essay answers.'],
        ['Under three minutes', 'Most people finish in about two.'],
        ['No login', 'We ask who you are at the end, not the beginning.'],
      ].map(([title, note], i) => (
        <li
          key={title}
          className={`flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6 ${
            i > 0 ? 'border-t border-rule' : ''
          }`}
        >
          <span className="font-heading text-[0.9375rem] font-semibold text-vapor-white sm:w-48 sm:shrink-0">
            {title}
          </span>
          <span className="font-sans text-[0.9375rem] leading-snug text-text-muted">
            {note}
          </span>
        </li>
      ))}
    </ul>

    <div className="mt-10">
      <button type="button" onClick={onStart} className="dma-button-primary">
        Start the assessment
      </button>
    </div>

    <p className="mt-6 font-sans text-[0.8125rem] leading-relaxed text-text-muted">
      Your answers are scored in your browser as you go, so you will see your
      result either way.
    </p>
  </section>
);

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

const Progress: React.FC<{ value: number; left: string; right: string }> = ({
  value,
  left,
  right,
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-4">
      <p className="font-sans text-xs font-medium tracking-[0.2em] uppercase text-text-muted">
        {left}
      </p>
      <p className="shrink-0 font-heading text-xs font-semibold tracking-[0.2em] tabular-nums text-text-muted">
        {right}
      </p>
    </div>
    <div className="mt-3 h-px w-full bg-rule" aria-hidden="true">
      <div
        className="dma-progress-fill h-px bg-tenx-gold"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="mt-8">
    <button type="button" onClick={onClick} className="dma-button-quiet">
      <span aria-hidden="true">←</span> Back
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/* Field                                                               */
/* ------------------------------------------------------------------ */

interface FieldRenderProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'data-dma-invalid': 'true' | undefined;
}

const Field: React.FC<{
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
}> = ({ id, label, optional, hint, error, children }) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {optional && (
          <span className="font-normal text-text-faint"> (optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 font-sans text-[0.8125rem] text-text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">
        {children({
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
          'data-dma-invalid': error ? 'true' : undefined,
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className={ERROR_TEXT}>
          {error}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

const Result: React.FC<{
  result: ScoreResult;
  companyName: string;
  saveState: SaveState;
  mailtoHref: string;
  onStartAgain: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}> = ({ result, companyName, saveState, mailtoHref, onStartAgain, containerRef }) => (
  <div
    ref={containerRef}
    tabIndex={-1}
    className="dma-result focus:outline-none"
  >
    <p className={EYEBROW}>
      Digital Maturity Score
      {companyName ? ` · ${companyName}` : ''}
    </p>

    <div className="mt-8 grid items-center gap-8 sm:grid-cols-[13rem_1fr] sm:gap-10">
      <ScoreDial score={result.overall} />
      <div>
        <h1 className="font-heading text-[clamp(2rem,8vw,3rem)] leading-[1.05] font-bold tracking-[-0.02em] text-vapor-white">
          {result.band.label}
        </h1>
        <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed text-vapor-white">
          {result.band.meaning}
        </p>
      </div>
    </div>

    <section className="mt-14 border-t border-rule pt-8">
      <h2 className={SECTION_HEADING}>The six areas</h2>
      <p className="mt-2 mb-7 font-sans text-[0.9375rem] leading-relaxed text-text-muted">
        The overall number is weighted. Operations and data count for most,
        because that is where the hours usually sit.
      </p>
      <DimensionBars dimensions={result.dimensions} />
    </section>

    <section className="mt-14 border-t border-rule pt-8">
      <h2 className={SECTION_HEADING}>Start with these two</h2>
      {typeof result.estimatedHoursPerWeek === 'number' && (
        <p className="mt-2 font-sans text-[0.9375rem] leading-relaxed text-text-muted">
          You put roughly {result.estimatedHoursPerWeek} hours a week into
          repeat admin. Here is where we would aim first.
        </p>
      )}

      {result.recommendations.length > 0 ? (
        <ol className="mt-8 m-0 list-none space-y-8 p-0">
          {result.recommendations.map((rec, index) => (
            <li key={rec.buildType} className="flex gap-4 sm:gap-6">
              <span
                className="mt-1 font-heading text-sm font-semibold tabular-nums text-tenx-gold"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-[1.125rem] leading-snug font-semibold text-vapor-white sm:text-xl">
                  {rec.label}
                </h3>
                <p className="mt-2.5 font-sans text-[0.9375rem] leading-relaxed text-vapor-white">
                  {rec.summary}
                </p>
                <p className="mt-3 font-sans text-[0.875rem] leading-relaxed text-text-muted">
                  Pointed to by {joinList(rec.drivers.map(dimensionLabel))}.
                </p>
                {rec.roi && (
                  <p className="mt-2 font-sans text-[0.875rem] font-medium text-tenx-gold">
                    About {rec.roi.hoursPerWeekRecovered} hours a week back.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 font-sans text-[0.9375rem] leading-relaxed text-vapor-white">
          Nothing stands out as the obvious first build, which is rare and a
          good sign. The call is where we would go looking for the edges.
        </p>
      )}
    </section>

    <section className="mt-14 border border-tenx-gold/35 p-6 sm:p-8">
      <h2 className={SECTION_HEADING}>Book your full assessment</h2>
      <p className="mt-3 font-sans text-[0.9375rem] leading-relaxed text-vapor-white">
        Twelve questions can only get you so far. On the call we go through the
        processes that actually run your business, put hours against them, and
        turn that into a build you can price. You keep the output either way.
      </p>
      <div className="mt-6">
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener"
          className="dma-button-primary"
        >
          Book your full assessment
        </a>
      </div>
      <p className="mt-4 font-sans text-[0.8125rem] text-text-muted">
        Free · 45 minutes · on Teams, at a time you choose
        <span className="sr-only"> (opens in a new tab)</span>
      </p>
      <p className="dma-print-only mt-3 font-sans text-[0.8125rem] break-all">
        {BOOKING_URL}
      </p>
    </section>

    <p className="dma-print-only mt-10 border-t pt-4 font-sans text-[0.75rem] leading-relaxed">
      Ten X Africa (Pty) Ltd · {CONTACT_EMAIL} · tenxafrica.co.za
    </p>

    <div className="dma-no-print mt-10 border-t border-rule pt-6">
      <SaveNote state={saveState} mailtoHref={mailtoHref} />
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="dma-button-quiet"
        >
          Print or save as PDF
        </button>
        <button type="button" onClick={onStartAgain} className="dma-button-quiet">
          Start again
        </button>
      </div>
      <p className="mt-5 font-sans text-[0.8125rem] leading-relaxed text-text-muted">
        This page keeps your answers in its web address, so you can bookmark it
        or send it to a colleague and it will look the same.
      </p>
    </div>
  </div>
);

const SaveNote: React.FC<{ state: SaveState; mailtoHref: string }> = ({
  state,
  mailtoHref,
}) => {
  if (state === 'saved') {
    return (
      <p className="font-sans text-[0.875rem] leading-relaxed text-text-muted">
        Saved. The team will pick this up and be in touch.
      </p>
    );
  }
  if (state === 'restored') {
    return (
      <p className="font-sans text-[0.875rem] leading-relaxed text-text-muted">
        This is your result, rebuilt from the link. Nothing was sent to us.
      </p>
    );
  }
  if (state === 'failed') {
    return (
      <p className="font-sans text-[0.875rem] leading-relaxed text-text-muted">
        We could not save this one — your score above is still correct. If you
        want it on our side,{' '}
        <a
          href={mailtoHref}
          className="dma-inline-link text-tenx-gold underline underline-offset-2"
        >
          send it to {CONTACT_EMAIL}
        </a>
        .
      </p>
    );
  }
  return null;
};

export default SelfServeAssessment;
