/**
 * The screen before the interview: who is this assessment with, and who is
 * running it.
 *
 * Flow, top to bottom:
 *   1. Search the CRM (company name, person, email or website). Each result
 *      shows the people, the open opportunities and whether an assessment
 *      already exists, so the interviewer knows what the CRM knows before
 *      the call starts.
 *   2. Pick a result (reusing an open opportunity or adding a new one), or
 *      say "not in the CRM yet" and fill in four fields. Either way the tool
 *      makes sure the Company and Opportunity exist; nobody pastes an id.
 *   3. Confirm the interviewer (pre-filled from the Microsoft sign-in) and the
 *      blended hourly rate the ROI maths uses. Start.
 *
 * A draft saved in this browser for a dropped call is listed at the top so it
 * can be resumed in one click.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createSession,
  explainApiError,
  lookup,
  type Identity,
  type LookupCompany,
  type SessionRequest,
} from './api';
import { countDraftAnswers, type DraftState, type SetupState } from './draft';
import { NumberField, TextField, FIELD_BASE, LABEL_BASE } from './fields';

export interface SessionSetupProps {
  identity: Identity | null;
  identityLoading: boolean;
  /** Token fallback for hosts without the sign-in (dev, preview). */
  token: string;
  onTokenChange: (v: string) => void;
  showTokenField: boolean;
  initial: SetupState;
  /** Fields that arrived on the URL, from a CRM link. */
  fromUrl: ReadonlySet<keyof SetupState>;
  drafts: { key: string; draft: DraftState }[];
  onResumeDraft: (key: string) => void;
  onStart: (setup: SetupState) => void;
}

type Stage = 'search' | 'chosen';

interface Choice {
  companyId: string;
  companyName: string;
  opportunityId: string;
  opportunityName: string;
  /** '' means "create a new opportunity for this assessment". */
  isNew: boolean;
}

const BTN_PRIMARY =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] bg-tenx-gold px-4 font-heading text-[0.75rem] font-semibold tracking-[0.14em] uppercase text-obsidian-void transition-colors duration-150 hover:bg-gold-hover disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold';
const BTN_SECONDARY =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-border-interactive px-4 font-heading text-[0.75rem] font-semibold tracking-[0.14em] uppercase text-vapor-white transition-colors duration-150 hover:border-vapor-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold';
const BTN_QUIET =
  'inline-flex min-h-11 items-center text-[0.9375rem] text-vapor-white underline underline-offset-4 decoration-border-interactive transition-colors duration-150 hover:text-tenx-gold hover:decoration-tenx-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanStage(stage: string): string {
  return stage.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function nameFromEmail(email: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Card({ title, children, step }: { title: string; children: ReactNode; step: number }) {
  return (
    <section className="border-t border-rule pt-6" aria-labelledby={`setup-step-${step}`}>
      <h2 id={`setup-step-${step}`} className="flex items-baseline gap-3 font-heading text-[1.25rem] font-semibold text-vapor-white">
        <span className="text-text-faint tabular-nums">{step}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SessionSetup({
  identity,
  identityLoading,
  token,
  onTokenChange,
  showTokenField,
  initial,
  fromUrl,
  drafts,
  onResumeDraft,
  onStart,
}: SessionSetupProps) {
  const [query, setQuery] = useState(initial.companyName);
  const [results, setResults] = useState<LookupCompany[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(initial.opportunityId ? 'chosen' : 'search');
  const [choice, setChoice] = useState<Choice | null>(
    initial.opportunityId
      ? {
          companyId: initial.companyId,
          companyName: initial.companyName,
          opportunityId: initial.opportunityId,
          opportunityName: 'From the CRM link',
          isNew: false,
        }
      : null
  );
  const [creating, setCreating] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', website: '', country: '', contactName: '', contactEmail: '' });
  const [interviewer, setInterviewer] = useState(initial.interviewer);
  const [rate, setRate] = useState<number | null>(initial.hourlyRateUsd || 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenOpen, setTokenOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  // Interviewer name from the sign-in, unless it came from the URL or was typed.
  useEffect(() => {
    if (interviewer.trim() !== '' || fromUrl.has('interviewer')) return;
    if (identity?.name) setInterviewer(identity.name);
    else if (identity?.email) setInterviewer(nameFromEmail(identity.email));
  }, [identity, fromUrl, interviewer]);

  const runSearch = useCallback(
    async (q: string) => {
      const mine = ++seq.current;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await lookup(q, token || undefined);
        if (mine !== seq.current) return;
        setResults(res.companies);
      } catch (err) {
        if (mine !== seq.current) return;
        setResults(null);
        setSearchError(explainApiError(err));
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (stage !== 'search') return;
    const q = query.trim();
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (q.length < 2) {
      setResults(null);
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void runSearch(q);
    }, 400);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [query, stage, runSearch]);

  const choose = (c: LookupCompany, opportunityId: string, opportunityName: string) => {
    setChoice({ companyId: c.id, companyName: c.name, opportunityId, opportunityName, isNew: opportunityId === '' });
    setStage('chosen');
    setError(null);
  };

  const startWithCreate = async () => {
    const name = newCompany.name.trim();
    if (name === '') {
      setError('The company name is needed to create the record.');
      return;
    }
    await start({
      companyName: name,
      website: newCompany.website.trim() || undefined,
      country: newCompany.country.trim() || undefined,
      contactName: newCompany.contactName.trim() || undefined,
      contactEmail: newCompany.contactEmail.trim() || undefined,
    });
  };

  const startWithChoice = async () => {
    if (!choice) return;
    await start({
      companyId: choice.companyId,
      companyName: choice.companyName,
      opportunityId: choice.isNew ? undefined : choice.opportunityId,
    });
  };

  const start = async (req: SessionRequest) => {
    if (interviewer.trim() === '') {
      setError('Add the interviewer’s name before starting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(req, token || undefined);
      onStart({
        companyName: session.companyName,
        companyId: session.companyId,
        opportunityId: session.opportunityId,
        interviewer: interviewer.trim(),
        hourlyRateUsd: rate && rate > 0 ? rate : 25,
      });
    } catch (err) {
      setError(explainApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const signedIn = identity?.via === 'access' && identity.email;

  return (
    <div className="mx-auto max-w-[44rem] px-4 pt-10 pb-24 sm:px-6">
      <p className="text-[0.75rem] tracking-[0.14em] text-text-faint uppercase">Guided assessment</p>
      <h1 className="mt-3 font-heading text-[clamp(1.875rem,6vw,2.5rem)] leading-[1.1] font-bold tracking-[-0.015em] text-vapor-white">
        Set up the call
      </h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-text-muted">
        Find the client in the CRM, confirm who is running the call, and start. Everything you type
        during the interview is saved in this browser as you go, and the result lands on the
        client&rsquo;s record when you submit.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-4 text-[0.875rem]">
        {identityLoading ? (
          <span className="text-text-faint">Checking your sign-in&hellip;</span>
        ) : signedIn ? (
          <span className="text-text-muted">
            Signed in as <span className="text-vapor-white">{identity?.name ?? identity?.email}</span>
            {identity?.name ? <span className="text-text-faint"> ({identity.email})</span> : null}
          </span>
        ) : identity?.via === 'token' ? (
          <span className="text-text-muted">Connected with the API token.</span>
        ) : (
          <span className="text-signal-bad">Not signed in. Lookups and submitting will not work until you are.</span>
        )}
        {showTokenField && (
          <button type="button" className={BTN_QUIET} onClick={() => setTokenOpen((v) => !v)} aria-expanded={tokenOpen}>
            {tokenOpen ? 'Hide the token field' : 'Not signed in? Use the API token'}
          </button>
        )}
      </div>
      {showTokenField && tokenOpen && (
        <div className="mt-3 max-w-[24rem]">
          <TextField
            id="setup-token"
            label="API token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={onTokenChange}
            hint="Only needed on this address. On tenxafrica.co.za your Microsoft sign-in does this."
          />
        </div>
      )}

      {drafts.length > 0 && (
        <section className="mt-8 border-t border-tenx-gold/40 pt-4" aria-label="Unfinished assessments in this browser">
          <p className="text-[0.75rem] tracking-[0.14em] text-tenx-gold uppercase">Pick up where you left off</p>
          <ul className="mt-2 divide-y divide-rule">
            {drafts.slice(0, 5).map(({ key, draft }) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 text-[0.9375rem] text-vapor-white">
                  {draft.setup.companyName.trim() || 'Unnamed company'}
                  <span className="block text-[0.8125rem] text-text-faint">
                    {countDraftAnswers(draft)} question{countDraftAnswers(draft) === 1 ? '' : 's'} captured &middot; saved{' '}
                    {new Date(draft.savedAt).toLocaleString('en-GB')}
                  </span>
                </span>
                <button type="button" className={BTN_SECONDARY} onClick={() => onResumeDraft(key)}>
                  Resume
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 space-y-10">
        <Card step={1} title="Who is this assessment with?">
          {stage === 'search' && !creating && (
            <>
              <label htmlFor="setup-search" className={`${LABEL_BASE} mb-1`}>
                Company, person, email or website
              </label>
              <input
                id="setup-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${FIELD_BASE} min-h-12 text-[1rem]`}
                placeholder="e.g. Acme Plumbing, jane@acme.com or acme.com"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1 text-[0.8125rem] text-text-faint" aria-live="polite">
                {searching
                  ? 'Searching the CRM…'
                  : searchError
                    ? searchError
                    : results === null
                      ? 'Results appear as you type.'
                      : results.length === 0
                        ? 'Nothing in the CRM matches. Create the record below.'
                        : `${results.length} match${results.length === 1 ? '' : 'es'}.`}
              </p>

              {results && results.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {results.map((c) => {
                    const open = c.opportunities.filter((o) => !['WON', 'LOST'].includes(o.stage));
                    return (
                      <li key={c.id} className="rounded-[2px] border border-rule bg-surface-1 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="font-heading text-[1.125rem] font-semibold text-vapor-white">{c.name}</h3>
                          <span className="text-[0.8125rem] text-text-faint">
                            {[c.domain.replace(/^https?:\/\//, ''), c.country, c.size.replace(/^S_/, '').replace(/_/g, '–').replace('PLUS', '+')]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>

                        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[0.875rem] sm:grid-cols-2">
                          <div>
                            <dt className="text-[0.75rem] tracking-[0.14em] text-text-faint uppercase">People</dt>
                            <dd className="mt-1 text-text-muted">
                              {c.people.length === 0
                                ? 'None recorded'
                                : c.people.slice(0, 4).map((p) => (
                                    <span key={p.id} className="block">
                                      {p.name || p.email}
                                      {p.role ? <span className="text-text-faint"> &middot; {humanStage(p.role)}</span> : null}
                                    </span>
                                  ))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[0.75rem] tracking-[0.14em] text-text-faint uppercase">Already in the CRM</dt>
                            <dd className="mt-1 text-text-muted">
                              {c.assessments.guided ? (
                                <span className="block text-gold-hover">
                                  Guided assessment done on {fmtDate(c.assessments.guided.date)}
                                </span>
                              ) : null}
                              {c.assessments.selfServe ? (
                                <span className="block">
                                  Self-serve score {c.assessments.selfServe.score ?? '?'}/100 on{' '}
                                  {fmtDate(c.assessments.selfServe.date)}
                                </span>
                              ) : null}
                              {!c.assessments.guided && !c.assessments.selfServe ? 'No assessment yet' : null}
                              {c.fitScore ? (
                                <span className="block text-text-faint">Fit {c.fitScore.replace('RATING_', '')}/5 &middot; {humanStage(c.relationship || 'prospect')}</span>
                              ) : null}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {open.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className={BTN_SECONDARY}
                              onClick={() => choose(c, o.id, o.name)}
                              title={o.name}
                            >
                              Use &ldquo;{o.name.length > 34 ? o.name.slice(0, 32) + '…' : o.name}&rdquo; ({humanStage(o.stage)})
                            </button>
                          ))}
                          <button type="button" className={open.length ? BTN_QUIET : BTN_PRIMARY} onClick={() => choose(c, '', '')}>
                            {open.length ? 'Or start a new opportunity' : 'Use this company'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-6">
                <button type="button" className={BTN_QUIET} onClick={() => { setCreating(true); setNewCompany((n) => ({ ...n, name: n.name || query.trim() })); }}>
                  Not in the CRM yet? Create the record
                </button>
              </div>
            </>
          )}

          {stage === 'search' && creating && (
            <div className="space-y-4">
              <p className="text-[0.9375rem] text-text-muted">
                The company and its opportunity are created in the CRM when you start. Only the name is required.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField id="new-company" label="Company name" required value={newCompany.name} onChange={(v) => setNewCompany((n) => ({ ...n, name: v }))} />
                </div>
                <TextField id="new-website" label="Website" value={newCompany.website} onChange={(v) => setNewCompany((n) => ({ ...n, website: v }))} hint="Optional." />
                <TextField id="new-country" label="Country" value={newCompany.country} onChange={(v) => setNewCompany((n) => ({ ...n, country: v }))} hint="Optional, e.g. United Kingdom." />
                <TextField id="new-contact" label="Person on the call" value={newCompany.contactName} onChange={(v) => setNewCompany((n) => ({ ...n, contactName: v }))} hint="Optional." />
                <TextField id="new-email" label="Their work email" value={newCompany.contactEmail} onChange={(v) => setNewCompany((n) => ({ ...n, contactEmail: v }))} hint="Optional. Creates the person and links them." />
              </div>
              <button type="button" className={BTN_QUIET} onClick={() => setCreating(false)}>
                Back to search
              </button>
            </div>
          )}

          {stage === 'chosen' && choice && (
            <div className="rounded-[2px] border border-tenx-gold/50 bg-surface-1 p-4">
              <p className="text-[0.75rem] tracking-[0.14em] text-tenx-gold uppercase">Chosen</p>
              <p className="mt-1 font-heading text-[1.125rem] font-semibold text-vapor-white">{choice.companyName}</p>
              <p className="mt-1 text-[0.875rem] text-text-muted">
                {choice.isNew
                  ? 'A new opportunity will be created for this assessment.'
                  : `Opportunity: ${choice.opportunityName}`}
              </p>
              <button type="button" className={`${BTN_QUIET} mt-3`} onClick={() => { setStage('search'); setChoice(null); }}>
                Change
              </button>
            </div>
          )}
        </Card>

        <Card step={2} title="Who is running it?">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <TextField
              id="setup-interviewer"
              label="Interviewer"
              required
              value={interviewer}
              onChange={setInterviewer}
              hint={signedIn ? 'Pre-filled from your sign-in.' : 'Your name, as it should appear on the report.'}
            />
            <NumberField
              id="setup-rate"
              label="Blended rate (USD/h)"
              value={rate}
              onChange={setRate}
              step={5}
              min={1}
              hint="Drives the ROI maths. 25 is the default."
            />
          </div>
        </Card>

        <Card step={3} title="Start">
          {error && (
            <p role="alert" className="mb-4 border-l-2 border-signal-bad pl-3 text-[0.9375rem] text-signal-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {stage === 'chosen' ? (
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void startWithChoice()}>
                {busy ? 'Preparing…' : 'Start the assessment'}
              </button>
            ) : creating ? (
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void startWithCreate()}>
                {busy ? 'Creating…' : 'Create and start'}
              </button>
            ) : (
              <p className="text-[0.9375rem] text-text-faint">Choose a company above first.</p>
            )}
          </div>
          <p className="mt-3 text-[0.8125rem] text-text-faint">
            Thirty questions across six areas, about 45 minutes. Nothing auto-advances and nothing is
            lost if the call drops.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default SessionSetup;
