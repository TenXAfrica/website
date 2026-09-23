/**
 * CRM lookup and session creation for the guided assessment tool.
 *
 * Before an assessment call the interviewer types who they are meeting.
 * `handleLookup` searches the CRM for that company, person, email or website
 * and returns everything the tool needs to decide "use this record" or
 * "create it": the company, its people, its open opportunities, and whether
 * an assessment (self-serve or guided) already exists.
 *
 * `handleSession` then makes sure the records the assessment will hang off
 * exist: a Company, optionally a Person, and an Opportunity. It reuses what
 * was chosen and creates only what is missing, so the tool never asks anyone
 * to paste an id.
 *
 * Both are internal: the router only reaches them for a verified Access
 * identity or the admin bearer. Input is still validated and capped, because
 * the values end up in CRM filters and record names.
 */

import { TwentyClient, logEvent, type TwentyRecord } from './twenty';
import { LIMITS, isValidEmail, toPrimaryLinkUrl } from './selfserve';
import { plainInline } from './notes';

/* ------------------------------------------------------------------ */
/* Shapes returned to the tool                                          */
/* ------------------------------------------------------------------ */

export interface LookupPerson {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LookupOpportunity {
  id: string;
  name: string;
  stage: string;
  createdAt: string;
}

export interface LookupAssessments {
  /** Most recent self-serve score note, if any. */
  selfServe: { score: number | null; date: string; noteId: string } | null;
  /** Most recent guided (full) assessment note, if any. */
  guided: { date: string; noteId: string } | null;
  /** All note titles on the company, newest first, capped. */
  noteTitles: string[];
}

export interface LookupCompany {
  id: string;
  name: string;
  domain: string;
  country: string;
  size: string;
  sector: string;
  relationship: string;
  fitScore: string;
  contactConsent: string;
  people: LookupPerson[];
  opportunities: LookupOpportunity[];
  assessments: LookupAssessments;
}

export interface LookupResult {
  ok: true;
  query: string;
  matchedBy: 'email' | 'domain' | 'name';
  companies: LookupCompany[];
}

const MAX_QUERY = 120;
const MAX_COMPANIES = 6;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function nested(record: TwentyRecord, ...path: string[]): unknown {
  let cur: unknown = record;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function personName(p: TwentyRecord): string {
  const first = str(nested(p, 'name', 'firstName'));
  const last = str(nested(p, 'name', 'lastName'));
  return `${first} ${last}`.trim();
}

const SELF_SERVE_TITLE = /(?:self-serve score|Digital Maturity Score)[\s\S]*?(\d{1,3})\s*\/\s*100/i;
const GUIDED_TITLE = /^DMA \(full\)/i;

export function summariseNotes(
  notes: { id: string; title: string; createdAt: string }[]
): LookupAssessments {
  const sorted = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  let selfServe: LookupAssessments['selfServe'] = null;
  let guided: LookupAssessments['guided'] = null;
  for (const n of sorted) {
    if (!guided && GUIDED_TITLE.test(n.title)) {
      guided = { date: n.createdAt, noteId: n.id };
      continue;
    }
    if (!selfServe) {
      const m = SELF_SERVE_TITLE.exec(n.title);
      if (m) {
        const score = Number.parseInt(m[1] as string, 10);
        selfServe = {
          score: Number.isFinite(score) ? score : null,
          date: n.createdAt,
          noteId: n.id,
        };
      }
    }
  }
  return { selfServe, guided, noteTitles: sorted.slice(0, 12).map((n) => n.title) };
}

/** Bare domain from a URL, an email or a typed domain; '' when not domain-like. */
export function extractDomain(query: string): string {
  const q = query.trim().toLowerCase();
  const fromEmail = q.includes('@') ? q.split('@')[1] ?? '' : '';
  const raw = (fromEmail || q).replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0] ?? '';
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(raw) ? raw : '';
}

/* ------------------------------------------------------------------ */
/* Lookup                                                               */
/* ------------------------------------------------------------------ */

export interface LookupDeps {
  twenty: TwentyClient;
}

async function companyDetail(twenty: TwentyClient, company: TwentyRecord): Promise<LookupCompany> {
  const id = str(company['id']);
  const [people, opportunities, noteTargets] = await Promise.all([
    twenty.findPeopleByCompany(id).catch((err) => {
      logEvent('warn', 'lookup-people-failed', err);
      return [] as TwentyRecord[];
    }),
    twenty.findOpportunitiesByCompany(id).catch((err) => {
      logEvent('warn', 'lookup-opportunities-failed', err);
      return [] as TwentyRecord[];
    }),
    twenty.findNoteTargetsByCompany(id).catch((err) => {
      logEvent('warn', 'lookup-notes-failed', err);
      return [] as TwentyRecord[];
    }),
  ]);

  const notes = noteTargets
    .map((t) => {
      const note = t['note'];
      if (typeof note !== 'object' || note === null) return null;
      const n = note as TwentyRecord;
      return { id: str(n['id']), title: str(n['title']), createdAt: str(n['createdAt']) };
    })
    .filter((n): n is { id: string; title: string; createdAt: string } => n !== null && n.title !== '');

  return {
    id,
    name: str(company['name']),
    domain: str(nested(company, 'domainName', 'primaryLinkUrl')),
    country: str(nested(company, 'address', 'addressCountry')),
    size: str(company['size']),
    sector: str(company['sector']),
    relationship: str(company['relationship']),
    fitScore: str(company['fitScore']),
    contactConsent: str(company['contactConsent']),
    people: people.slice(0, 10).map((p) => ({
      id: str(p['id']),
      name: personName(p),
      email: str(nested(p, 'emails', 'primaryEmail')),
      role: str(p['decisionRole']) || str(p['jobTitle']),
    })),
    opportunities: opportunities
      .slice(0, 10)
      .map((o) => ({
        id: str(o['id']),
        name: str(o['name']),
        stage: str(o['stage']),
        createdAt: str(o['createdAt']),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    assessments: summariseNotes(notes),
  };
}

export async function handleLookup(
  rawQuery: string,
  deps: LookupDeps
): Promise<{ status: number; body: LookupResult | { ok: false; error: string } }> {
  const query = rawQuery.trim().slice(0, MAX_QUERY);
  if (query.length < 2) {
    return { status: 400, body: { ok: false, error: 'query_too_short' } };
  }

  const { twenty } = deps;
  let matchedBy: LookupResult['matchedBy'] = 'name';
  let companies: TwentyRecord[] = [];

  if (query.includes('@') && isValidEmail(query.toLowerCase())) {
    matchedBy = 'email';
    const person = await twenty.findPersonByEmail(query.toLowerCase()).catch(() => null);
    const companyId = person ? str(person['companyId']) : '';
    if (companyId) {
      const company = await twenty.findCompanyById(companyId).catch(() => null);
      if (company) companies = [company];
    }
  }

  if (companies.length === 0) {
    const domain = extractDomain(query);
    if (domain) {
      matchedBy = 'domain';
      companies = await twenty.findCompaniesByDomainLike(domain, MAX_COMPANIES).catch(() => []);
    }
  }

  if (companies.length === 0) {
    matchedBy = 'name';
    companies = await twenty.findCompaniesByNameLike(query, MAX_COMPANIES).catch(() => []);
  }

  const detailed = await Promise.all(companies.slice(0, MAX_COMPANIES).map((c) => companyDetail(twenty, c)));
  logEvent('info', 'lookup-ok', { matchedBy, count: detailed.length });
  return { status: 200, body: { ok: true, query, matchedBy, companies: detailed } };
}

/* ------------------------------------------------------------------ */
/* Session: make sure Company (+Person) + Opportunity exist             */
/* ------------------------------------------------------------------ */

export interface SessionRequest {
  companyId?: string;
  companyName: string;
  website?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  opportunityId?: string;
}

export interface SessionResponse {
  ok: true;
  companyId: string;
  companyName: string;
  opportunityId: string;
  personId?: string;
  created: ('company' | 'person' | 'opportunity')[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function validateSession(body: unknown):
  | { ok: true; value: SessionRequest }
  | { ok: false; errors: string[] } {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] };
  const errors: string[] = [];
  const companyId = clean(body['companyId'], 64);
  const companyName = clean(body['companyName'], LIMITS.company);
  if (!companyName) errors.push('companyName is required');
  const website = clean(body['website'], LIMITS.website);
  const country = clean(body['country'], LIMITS.country);
  const contactName = clean(body['contactName'], LIMITS.name);
  const contactEmail = clean(body['contactEmail'], LIMITS.email).toLowerCase();
  if (contactEmail && !isValidEmail(contactEmail)) errors.push('contactEmail is not valid');
  const opportunityId = clean(body['opportunityId'], 64);
  if (errors.length) return { ok: false, errors };
  const value: SessionRequest = { companyName };
  if (companyId) value.companyId = companyId;
  if (website) value.website = website;
  if (country) value.country = country;
  if (contactName) value.contactName = contactName;
  if (contactEmail) value.contactEmail = contactEmail;
  if (opportunityId) value.opportunityId = opportunityId;
  return { ok: true, value };
}

export interface SessionDeps {
  twenty: TwentyClient;
  /** Who is running the tool, for the opportunity's "next step" line. */
  interviewer?: string;
  now?: () => Date;
}

export async function handleSession(
  body: unknown,
  deps: SessionDeps
): Promise<{ status: number; body: SessionResponse | { ok: false; error: string; details?: string[] } }> {
  const validated = validateSession(body);
  if (!validated.ok) {
    return { status: 400, body: { ok: false, error: 'invalid_session', details: validated.errors } };
  }
  const req = validated.value;
  const { twenty } = deps;
  const created: SessionResponse['created'] = [];

  /* --- company --- */
  let companyId = req.companyId ?? '';
  if (companyId) {
    const existing = await twenty.findCompanyById(companyId).catch(() => null);
    if (!existing) {
      return { status: 404, body: { ok: false, error: 'company_not_found' } };
    }
  } else {
    const input: Record<string, unknown> = {
      name: req.companyName,
      relationship: 'PROSPECT',
      contactConsent: 'ASKED',
    };
    const link = toPrimaryLinkUrl(req.website);
    if (link) input['domainName'] = { primaryLinkUrl: link, primaryLinkLabel: '' };
    if (req.country) input['address'] = { addressCountry: req.country };
    const company = await twenty.createCompany(input);
    if (!company || !str(company['id'])) {
      return { status: 502, body: { ok: false, error: 'company_create_failed' } };
    }
    companyId = str(company['id']);
    created.push('company');
  }

  /* --- person (optional) --- */
  let personId: string | undefined;
  if (req.contactEmail) {
    const found = await twenty.findPersonByEmail(req.contactEmail).catch(() => null);
    if (found && str(found['id'])) {
      personId = str(found['id']);
    } else {
      const parts = (req.contactName ?? '').split(/\s+/).filter(Boolean);
      const person = await twenty
        .createPerson({
          name: { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') },
          emails: { primaryEmail: req.contactEmail },
          companyId,
          decisionRole: 'DECISION_MAKER',
        })
        .catch((err) => {
          logEvent('warn', 'session-person-failed', err);
          return null;
        });
      if (person && str(person['id'])) {
        personId = str(person['id']);
        created.push('person');
      }
    }
  }

  /* --- opportunity --- */
  let opportunityId = req.opportunityId ?? '';
  if (opportunityId) {
    const existing = await twenty.findOpportunityById(opportunityId).catch(() => null);
    if (!existing) {
      return { status: 404, body: { ok: false, error: 'opportunity_not_found' } };
    }
  } else {
    const now = deps.now?.() ?? new Date();
    const input: Record<string, unknown> = {
      name: plainInline(req.companyName, 100) + ' — Digital Maturity Assessment',
      stage: 'CALL_BOOKED',
      source: 'INBOUND',
      serviceLine: 'AI_SYSTEM',
      dealType: 'HYBRID',
      companyId,
      nextStep: 'Guided assessment' + (deps.interviewer ? ' with ' + plainInline(deps.interviewer, 60) : ''),
      nextStepDate: now.toISOString(),
    };
    if (personId) input['pointOfContactId'] = personId;
    const opp = await twenty.createOpportunity(input);
    if (!opp || !str(opp['id'])) {
      return { status: 502, body: { ok: false, error: 'opportunity_create_failed' } };
    }
    opportunityId = str(opp['id']);
    created.push('opportunity');
  }

  logEvent('info', 'session-ok', { created });
  const response: SessionResponse = {
    ok: true,
    companyId,
    companyName: req.companyName,
    opportunityId,
    created,
  };
  if (personId) response.personId = personId;
  return { status: 200, body: response };
}
