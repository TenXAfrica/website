/**
 * Self-serve DMA handler, plus the contact-form passthrough.
 *
 * The body of a self-serve submission is public input from a browser, so it
 * is validated field by field before it reaches the scorer or the CRM. The
 * CRM writes that follow are deliberately fault-tolerant: every step is
 * wrapped in `attempt()`, which logs a redacted failure and returns null
 * rather than throwing. A lead half-written into Twenty is worth far more
 * than a lead rejected because a note target failed.
 */

import type {
  ScoreResult,
  SelfServeContact,
  SelfServeSubmission,
} from '../../shared/dma/types';
import { SELF_SERVE_QUESTIONS } from '../../shared/dma/questions';
import { scoreSelfServe, selfServeIsComplete } from '../../shared/dma/scoring';
import {
  contactNoteTitle,
  mdInline,
  plainInline,
  renderContactNote,
  renderSelfServeNote,
  renderSelfServeTaskBody,
  selfServeNoteTitle,
  type ContactNoteInput,
  type SelfServeNoteInput,
} from './notes';
import { TwentyClient, logEvent, logLeadRecovery } from './twenty';

/* ------------------------------------------------------------------ */
/* Validation primitives                                               */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  company: 200,
  email: 320,
  name: 200,
  country: 100,
  sector: 200,
  website: 500,
  freeText: 2000,
  token: 4096,
} as const;

export const COMPANY_SIZES: readonly SelfServeContact['size'][] = [
  'S_1_5',
  'S_6_20',
  'S_21_50',
  'S_51_200',
  'S_200_PLUS',
];

/**
 * Deliberately conservative. This is a gate, not a parser: anything it lets
 * through still gets length-capped before it reaches the CRM.
 */
const EMAIL_RE = /^[^\s@,;:<>()[\]\\]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * Strip control characters so nothing odd lands in a CRM field.
 *
 * Written as a codepoint filter rather than a regex on purpose: a character
 * class of `\u00xx` escapes is one careless reformat away from becoming
 * literal control bytes in the source, and this file has already been
 * through that once.
 *
 * Tab, newline and carriage return are kept deliberately -- they are
 * legitimate in a message body. That is exactly why every caller that puts
 * this text into markdown must run it through mdInline or blockquote first.
 */
function clean(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isC0Control = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (isC0Control || code === 0x7f) continue;
    out += ch;
  }
  return out.trim();
}

export function isValidEmail(value: string): boolean {
  if (value.length < 3 || value.length > LIMITS.email) return false;
  if (value.includes('..')) return false;
  return EMAIL_RE.test(value);
}

/** Build the lookup of question id -> allowed option values, once. */
const ALLOWED_ANSWERS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  SELF_SERVE_QUESTIONS.map((q) => [q.id, new Set(q.options.map((o) => o.value))])
);

/* ------------------------------------------------------------------ */
/* Self-serve payload validator                                        */
/* ------------------------------------------------------------------ */

export interface ValidSelfServe {
  answers: Record<string, string>;
  contact: SelfServeContact;
  turnstileToken: string;
}

export function validateSelfServe(body: unknown): ValidationResult<ValidSelfServe> {
  const errors: string[] = [];

  if (!isPlainObject(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }

  if (body['version'] !== 'dma-selfserve-1') {
    errors.push('version must be "dma-selfserve-1"');
  }

  /* --- turnstile token --- */
  const token = str(body['turnstileToken']);
  if (!token || token.length > LIMITS.token) {
    errors.push('turnstileToken is required');
  }

  /* --- answers --- */
  const rawAnswers = body['answers'];
  const answers: Record<string, string> = {};
  if (!isPlainObject(rawAnswers)) {
    errors.push('answers must be an object of questionId -> optionValue');
  } else {
    const keys = Object.keys(rawAnswers);
    if (keys.length > ALLOWED_ANSWERS.size) {
      errors.push('answers contains more keys than there are questions');
    }
    for (const key of keys) {
      const allowed = ALLOWED_ANSWERS.get(key);
      if (!allowed) {
        errors.push('unknown question id: ' + key.slice(0, 40));
        continue;
      }
      const value = rawAnswers[key];
      if (typeof value !== 'string' || !allowed.has(value)) {
        errors.push('invalid option for question ' + key);
        continue;
      }
      answers[key] = value;
    }
    if (errors.length === 0 && !selfServeIsComplete(answers)) {
      errors.push('every question must be answered');
    }
  }

  /* --- contact --- */
  const rawContact = body['contact'];
  let contact: SelfServeContact | null = null;

  if (!isPlainObject(rawContact)) {
    errors.push('contact must be an object');
  } else {
    const companyName = str(rawContact['companyName']);
    const fullName = str(rawContact['fullName']);
    const email = str(rawContact['email']);
    const country = str(rawContact['country']);
    const size = rawContact['size'];
    const sector = str(rawContact['sector']);
    const website = str(rawContact['website']);
    const biggestTimeSink = str(rawContact['biggestTimeSink']);
    const consent = rawContact['consent'];

    if (!companyName) errors.push('contact.companyName is required');
    else if (companyName.length > LIMITS.company) {
      errors.push('contact.companyName exceeds ' + LIMITS.company + ' characters');
    }

    if (!fullName) errors.push('contact.fullName is required');
    else if (fullName.length > LIMITS.name) {
      errors.push('contact.fullName exceeds ' + LIMITS.name + ' characters');
    }

    if (!email) errors.push('contact.email is required');
    else if (email.length > LIMITS.email) {
      errors.push('contact.email exceeds ' + LIMITS.email + ' characters');
    } else if (!isValidEmail(email)) {
      errors.push('contact.email is not a valid email address');
    }

    if (!country) errors.push('contact.country is required');
    else if (country.length > LIMITS.country) {
      errors.push('contact.country exceeds ' + LIMITS.country + ' characters');
    }

    if (typeof size !== 'string' || !COMPANY_SIZES.includes(size as SelfServeContact['size'])) {
      errors.push('contact.size must be one of ' + COMPANY_SIZES.join(', '));
    }

    if (sector && sector.length > LIMITS.sector) {
      errors.push('contact.sector exceeds ' + LIMITS.sector + ' characters');
    }
    if (website && website.length > LIMITS.website) {
      errors.push('contact.website exceeds ' + LIMITS.website + ' characters');
    }
    if (biggestTimeSink && biggestTimeSink.length > LIMITS.freeText) {
      errors.push('contact.biggestTimeSink exceeds ' + LIMITS.freeText + ' characters');
    }

    // Consent drives Company.contactConsent, so it must be an explicit
    // boolean. A missing tick is not the same as a false tick.
    if (typeof consent !== 'boolean') {
      errors.push('contact.consent must be true or false');
    }

    if (errors.length === 0) {
      contact = {
        companyName: clean(companyName as string),
        fullName: clean(fullName as string),
        email: (email as string).toLowerCase(),
        country: clean(country as string),
        size: size as SelfServeContact['size'],
        consent: consent as boolean,
      };
      if (sector) contact.sector = clean(sector);
      if (website) contact.website = clean(website);
      if (biggestTimeSink) contact.biggestTimeSink = clean(biggestTimeSink);
    }
  }

  if (errors.length > 0 || !contact || !token) {
    return { ok: false, errors: errors.length ? errors : ['invalid submission'] };
  }

  // `submittedAt` from the client is deliberately dropped. The Note uses
  // server time.
  return { ok: true, value: { answers, contact, turnstileToken: token } };
}

/* ------------------------------------------------------------------ */
/* Contact form validator                                              */
/* ------------------------------------------------------------------ */

export interface ValidContact {
  fullName: string;
  email: string;
  company?: string;
  website?: string;
  phone?: string;
  message: string;
  consent: boolean;
  turnstileToken: string;
}

export function validateContact(body: unknown): ValidationResult<ValidContact> {
  const errors: string[] = [];
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }

  const fullName = str(body['fullName']) ?? str(body['name']);
  const email = str(body['email']);
  const company = str(body['company']) ?? str(body['companyName']);
  const website = str(body['website']);
  const phone = str(body['phone']);
  const message = str(body['message']);
  const token = str(body['turnstileToken']);
  const consent = body['consent'];

  if (!fullName) errors.push('fullName is required');
  else if (fullName.length > LIMITS.name) errors.push('fullName is too long');

  if (!email) errors.push('email is required');
  else if (!isValidEmail(email)) errors.push('email is not a valid email address');

  if (!message) errors.push('message is required');
  else if (message.length > LIMITS.freeText) errors.push('message is too long');

  if (company && company.length > LIMITS.company) errors.push('company is too long');
  if (website && website.length > LIMITS.website) errors.push('website is too long');
  if (phone && phone.length > 50) errors.push('phone is too long');
  if (!token || token.length > LIMITS.token) errors.push('turnstileToken is required');

  if (errors.length > 0 || !token) {
    return { ok: false, errors: errors.length ? errors : ['invalid submission'] };
  }

  const value: ValidContact = {
    fullName: clean(fullName as string),
    email: (email as string).toLowerCase(),
    message: clean(message as string),
    consent: consent === true,
    turnstileToken: token,
  };
  if (company) value.company = clean(company);
  if (website) value.website = clean(website);
  if (phone) value.phone = clean(phone);

  return { ok: true, value };
}

/* ------------------------------------------------------------------ */
/* Shared CRM helpers                                                  */
/* ------------------------------------------------------------------ */

/** Run a CRM step. Log a redacted failure and keep going. */
async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logEvent('warn', 'crm-step-failed:' + label, err);
    return null;
  }
}

/**
 * Turn whatever the prospect typed into a canonical https origin, or null.
 * Twenty stores it as `domainName: { primaryLinkUrl }`.
 */
export function toPrimaryLinkUrl(website: string | undefined): string | null {
  if (!website) return null;
  const raw = website.trim();
  if (!raw || raw.length > LIMITS.website) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.')) return null;
    return 'https://' + host;
  } catch {
    return null;
  }
}

/** "Jane Mary Smith" -> { firstName: "Jane", lastName: "Mary Smith" } */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0] as string, lastName: '' };
  return {
    firstName: parts[0] as string,
    lastName: parts.slice(1).join(' '),
  };
}

/** Now + one working day, in UTC. Saturday and Sunday roll to Monday. */
export function nextWorkingDay(from: Date): Date {
  const due = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const day = due.getUTCDay();
  if (day === 6) due.setUTCDate(due.getUTCDate() + 2); // Sat -> Mon
  else if (day === 0) due.setUTCDate(due.getUTCDate() + 1); // Sun -> Mon
  return due;
}

/** The `need` on the Opportunity: their words first, our guess second. */
export function needFor(contact: SelfServeContact, result: ScoreResult): string {
  const spoken = contact.biggestTimeSink?.trim();
  if (spoken) return spoken.slice(0, LIMITS.freeText);
  const top = result.recommendations[0];
  return top ? top.label : 'Digital maturity assessment follow-up';
}

export interface MatchedCompany {
  id: string;
  /** Read so an OPTED_OUT company can never be handed to a follow-up task. */
  contactConsent: string | null;
}

/** The host part of an email address, lowercased. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const host = email.slice(at + 1).trim().toLowerCase();
  return host.includes('.') ? host.replace(/^www\./, '') : null;
}

function consentOf(record: Record<string, unknown>): string | null {
  const value = record['contactConsent'];
  return typeof value === 'string' ? value : null;
}

function domainHostOf(record: Record<string, unknown>): string | null {
  const domainName = record['domainName'];
  if (!domainName || typeof domainName !== 'object') return null;
  const url = (domainName as { primaryLinkUrl?: unknown }).primaryLinkUrl;
  if (typeof url !== 'string' || !url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Find the Company we already have for this lead, if any.
 *
 * Reuse is only safe when the submitter has demonstrated some connection to
 * the record. A bare name match is not that: anyone can type a known client's
 * company name, and reusing on it would attach a DECISION_MAKER Person, an
 * Opportunity and a follow-up task to the real client's record.
 *
 * So: a domain match is trusted. A name-only match is trusted only when the
 * submitter's own email domain matches the domain already on that Company.
 * Otherwise we create a separate record.
 *
 * The cost is real and worth naming: two legitimate submissions from the same
 * company, neither giving a website, now create two Companies. Deduplicating
 * those by hand is a chore. Silently welding a stranger onto a client's
 * record is a breach.
 */
async function findExistingCompany(
  twenty: TwentyClient,
  name: string,
  primaryLinkUrl: string | null,
  submitterEmail: string
): Promise<MatchedCompany | null> {
  if (primaryLinkUrl) {
    const byDomain = await attempt('find-company-by-domain', () =>
      twenty.findCompanyByDomain(primaryLinkUrl)
    );
    if (byDomain) {
      return { id: byDomain.id, contactConsent: consentOf(byDomain) };
    }
  }

  const byName = await attempt('find-company-by-name', () => twenty.findCompanyByName(name));
  if (!byName) return null;

  const companyHost = domainHostOf(byName);
  const submitterHost = emailDomain(submitterEmail);

  if (companyHost && submitterHost && companyHost === submitterHost) {
    return { id: byName.id, contactConsent: consentOf(byName) };
  }

  logEvent('warn', 'company-name-match-rejected', {
    reason: 'submitter email domain does not match the company on file',
  });
  return null;
}

/**
 * Reuse a Person only when they are unattached or already belong to the
 * Company we resolved. A global email match would otherwise let a submission
 * bolt an Opportunity onto a person who works somewhere else entirely.
 */
async function findReusablePerson(
  twenty: TwentyClient,
  email: string,
  companyId: string | null
): Promise<{ id: string } | null> {
  const found = await attempt('find-person-by-email', () => twenty.findPersonByEmail(email));
  if (!found) return null;

  const theirCompany = found['companyId'];
  if (typeof theirCompany !== 'string' || theirCompany === '' || theirCompany === companyId) {
    return found;
  }

  logEvent('warn', 'person-email-match-rejected', {
    reason: 'existing person belongs to a different company',
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Self-serve: the CRM write sequence                                  */
/* ------------------------------------------------------------------ */

export interface CrmWriteOutcome {
  companyId: string | null;
  personId: string | null;
  opportunityId: string | null;
  noteId: string | null;
  taskId: string | null;
  /** Step labels that failed. Logged, never returned to the browser. */
  failures: string[];
}

export async function writeSelfServeToCrm(
  twenty: TwentyClient,
  input: SelfServeNoteInput
): Promise<CrmWriteOutcome> {
  const { contact, result } = input;
  const failures: string[] = [];
  const track = <T>(label: string, value: T | null): T | null => {
    if (value === null) failures.push(label);
    return value;
  };

  const primaryLinkUrl = toPrimaryLinkUrl(contact.website);

  /* --- a. Company --- */
  const existing = await findExistingCompany(
    twenty,
    contact.companyName,
    primaryLinkUrl,
    contact.email
  );

  // CLAUDE.md is unambiguous: any opt-out means never contact again. We still
  // record the score -- the submission happened and the note is the evidence
  // -- but the follow-up task must be impossible for a downstream routine to
  // misread as an invitation to draft an email.
  const optedOut = existing?.contactConsent === 'OPTED_OUT';
  if (optedOut) {
    logEvent('warn', 'selfserve-company-opted-out');
  }

  let companyId: string | null = existing?.id ?? null;
  if (!companyId) {
    const companyInput: Record<string, unknown> = {
      name: contact.companyName,
      size: contact.size,
      signals: result.signals,
      fitScore: result.fitScore,
      relationship: 'PROSPECT',
      contactConsent: contact.consent ? 'CONSENTED' : 'ASKED',
      address: { addressCountry: contact.country },
      position: 'first',
    };
    if (primaryLinkUrl) companyInput['domainName'] = { primaryLinkUrl };
    if (contact.sector) companyInput['sector'] = contact.sector;

    const created = track(
      'company',
      await attempt('create-company', () => twenty.createCompany(companyInput))
    );
    companyId = created?.id ?? null;
  } else {
    logEvent('info', 'reusing-existing-company');
  }

  /* --- b. Person --- */
  const existingPerson = await findReusablePerson(twenty, contact.email, companyId);

  let personId: string | null = existingPerson?.id ?? null;
  if (!personId) {
    const { firstName, lastName } = splitName(contact.fullName);
    const personInput: Record<string, unknown> = {
      name: { firstName, lastName },
      emails: { primaryEmail: contact.email },
      decisionRole: 'DECISION_MAKER',
      position: 'first',
    };
    if (companyId) personInput['companyId'] = companyId;

    const created = track(
      'person',
      await attempt('create-person', () => twenty.createPerson(personInput))
    );
    personId = created?.id ?? null;
  }

  /* --- c. Opportunity --- */
  const opportunityInput: Record<string, unknown> = {
    name: contact.companyName + ' — Digital Maturity Score ' + result.overall,
    stage: 'NEW',
    source: 'INBOUND',
    serviceLine: 'AI_SYSTEM',
    dealType: 'PROJECT',
    need: needFor(contact, result),
    timing: 'UNKNOWN',
    budgetBand: 'UNKNOWN',
    nextStep: 'Book the full Digital Maturity Assessment',
    position: 'first',
  };
  if (companyId) opportunityInput['companyId'] = companyId;
  if (personId) opportunityInput['pointOfContactId'] = personId;

  const opportunity = track(
    'opportunity',
    await attempt('create-opportunity', () => twenty.createOpportunity(opportunityInput))
  );
  const opportunityId = opportunity?.id ?? null;

  /* --- d. Note, then one note target per record --- */
  const note = track(
    'note',
    await attempt('create-note', () =>
      twenty.createNote({
        title: selfServeNoteTitle(contact, result),
        bodyV2: { markdown: renderSelfServeNote(input) },
        position: 'first',
      })
    )
  );
  const noteId = note?.id ?? null;

  if (noteId) {
    const targets: Array<[string, Record<string, unknown>]> = [];
    if (companyId) targets.push(['note-target-company', { noteId, companyId }]);
    if (personId) targets.push(['note-target-person', { noteId, personId }]);
    if (opportunityId) targets.push(['note-target-opportunity', { noteId, opportunityId }]);
    for (const [label, payload] of targets) {
      const created = await attempt(label, () => twenty.createNoteTarget(payload));
      if (!created) failures.push(label);
    }
  }

  /* --- e. Task for the @claude queue --- */
  const now = new Date(input.receivedAt);
  // Titles are plain text in Twenty, so they get plainInline, not mdInline.
  const safeName = plainInline(contact.companyName, 120);

  // An opted-out company must never produce a task that reads like an
  // instruction to make contact. The title itself carries the warning, so a
  // routine scanning titles cannot miss it.
  //
  // The same goes for a submitter who did not tick the consent box: the
  // rubric says they get their result on screen and nothing else, so the
  // task must not read like an instruction to email them. Both the title
  // and the body say so; the body renderer never emits the "draft the
  // invite" line in these two cases.
  const taskTitle = optedOut
    ? '@claude OPTED OUT - do not contact: ' + safeName
    : contact.consent
      ? '@claude Follow up DMA score: ' + safeName
      : '@claude DMA score, no consent - do not email: ' + safeName;

  const taskBody = optedOut
    ? [
        'DO NOT CONTACT. This company is set to OPTED_OUT in the CRM.',
        'They submitted the self-serve assessment anyway. Record the score,',
        'take no outbound action, and do not draft an email.',
        '',
        renderSelfServeTaskBody(input, 'no-contact'),
      ].join('\n')
    : renderSelfServeTaskBody(input, contact.consent ? 'invite' : 'no-contact');

  const task = track(
    'task',
    await attempt('create-task', () =>
      twenty.createTask({
        title: taskTitle,
        status: 'TODO',
        dueAt: nextWorkingDay(Number.isNaN(now.getTime()) ? new Date() : now).toISOString(),
        bodyV2: { markdown: taskBody },
        position: 'first',
      })
    )
  );
  const taskId = task?.id ?? null;

  if (taskId) {
    if (companyId) {
      const created = await attempt('task-target-company', () =>
        twenty.createTaskTarget({ taskId, companyId })
      );
      if (!created) failures.push('task-target-company');
    }
    if (opportunityId) {
      const created = await attempt('task-target-opportunity', () =>
        twenty.createTaskTarget({ taskId, opportunityId })
      );
      if (!created) failures.push('task-target-opportunity');
    }
  }

  return { companyId, personId, opportunityId, noteId, taskId, failures };
}

/* ------------------------------------------------------------------ */
/* Self-serve: request handler                                         */
/* ------------------------------------------------------------------ */

export interface SelfServeDeps {
  twenty: TwentyClient;
  version: string;
  now?: () => Date;
}

export interface SelfServeHandlerResult {
  status: number;
  body: { ok: true; result: ScoreResult } | { ok: false; error: string; details?: string[] };
}

export async function handleSelfServe(
  body: unknown,
  deps: SelfServeDeps
): Promise<SelfServeHandlerResult> {
  const validated = validateSelfServe(body);
  if (!validated.ok) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_submission', details: validated.errors.slice(0, 10) },
    };
  }

  const { answers, contact } = validated.value;
  const result = scoreSelfServe(answers, contact);
  const receivedAt = (deps.now?.() ?? new Date()).toISOString();

  const noteInput: SelfServeNoteInput = {
    contact,
    answers,
    result,
    receivedAt,
    version: deps.version,
  };

  const outcome = await writeSelfServeToCrm(deps.twenty, noteInput);

  // "Never lose a lead" has to mean something. If neither the Note nor the
  // Task landed, nothing in the CRM records that this person ever submitted,
  // and we are about to return ok:true to them. The only remaining copy is
  // this log line, so it carries the whole submission and deliberately keeps
  // the email address -- a redacted copy of a lost lead is worthless.
  //
  // TODO(Joash): once the DMA_RATELIMIT namespace exists, stash the raw
  // submission in KV here under `lead-recovery:<timestamp>` with a 30-day
  // TTL, so recovery does not depend on log retention.
  if (!outcome.noteId || !outcome.taskId) {
    logLeadRecovery('selfserve-lead-recovery-required', {
      receivedAt,
      failures: outcome.failures,
      wrote: {
        companyId: Boolean(outcome.companyId),
        personId: Boolean(outcome.personId),
        opportunityId: Boolean(outcome.opportunityId),
        noteId: Boolean(outcome.noteId),
        taskId: Boolean(outcome.taskId),
      },
      contact,
      answers,
      overall: result.overall,
    });
  } else if (outcome.failures.length > 0) {
    logEvent('warn', 'selfserve-partial-crm-write', { failures: outcome.failures });
  } else {
    logEvent('info', 'selfserve-crm-write-ok');
  }

  // Only the score goes back to the browser. No CRM ids, ever.
  return { status: 200, body: { ok: true, result } };
}

/* ------------------------------------------------------------------ */
/* Contact form: request handler                                       */
/* ------------------------------------------------------------------ */

export function contactCompanyLabel(input: ValidContact): string {
  if (input.company) return input.company;
  const domain = input.email.split('@')[1];
  if (domain && !FREE_EMAIL_DOMAINS.has(domain)) return domain;
  return input.fullName;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'webmail.co.za',
  'mweb.co.za',
]);

export async function handleContact(
  body: unknown,
  deps: SelfServeDeps
): Promise<{ status: number; body: { ok: boolean; error?: string; details?: string[] } }> {
  const validated = validateContact(body);
  if (!validated.ok) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_submission', details: validated.errors.slice(0, 10) },
    };
  }

  const input = validated.value;
  const twenty = deps.twenty;
  const receivedAt = (deps.now?.() ?? new Date()).toISOString();
  const companyLabel = contactCompanyLabel(input);
  const primaryLinkUrl = toPrimaryLinkUrl(input.website);

  /* --- Company --- */
  const existing = await findExistingCompany(
    twenty,
    companyLabel,
    primaryLinkUrl,
    input.email
  );
  const optedOut = existing?.contactConsent === 'OPTED_OUT';
  let companyId = existing?.id ?? null;
  if (!companyId) {
    const companyInput: Record<string, unknown> = {
      name: companyLabel,
      relationship: 'PROSPECT',
      // They wrote to us. That is an approach we may answer, but it is not
      // blanket marketing consent unless they ticked the box.
      contactConsent: input.consent ? 'CONSENTED' : 'ASKED',
      position: 'first',
    };
    if (primaryLinkUrl) companyInput['domainName'] = { primaryLinkUrl };
    const created = await attempt('contact-create-company', () =>
      twenty.createCompany(companyInput)
    );
    companyId = created?.id ?? null;
  }

  /* --- Person --- */
  const existingPerson = await findReusablePerson(twenty, input.email, companyId);
  let personId = existingPerson?.id ?? null;
  if (!personId) {
    const { firstName, lastName } = splitName(input.fullName);
    const personInput: Record<string, unknown> = {
      name: { firstName, lastName },
      emails: { primaryEmail: input.email },
      position: 'first',
    };
    if (companyId) personInput['companyId'] = companyId;
    if (input.phone) personInput['phones'] = { primaryPhoneNumber: input.phone };
    const created = await attempt('contact-create-person', () =>
      twenty.createPerson(personInput)
    );
    personId = created?.id ?? null;
  }

  /* --- Note --- */
  const noteInput: ContactNoteInput = {
    fullName: input.fullName,
    email: input.email,
    companyLabel,
    message: input.message,
    consent: input.consent,
    receivedAt,
  };
  if (input.company) noteInput.company = input.company;
  if (input.website) noteInput.website = input.website;
  if (input.phone) noteInput.phone = input.phone;

  const note = await attempt('contact-create-note', () =>
    twenty.createNote({
      title: contactNoteTitle(noteInput),
      bodyV2: { markdown: renderContactNote(noteInput) },
      position: 'first',
    })
  );

  if (note?.id) {
    if (companyId) {
      await attempt('contact-note-target-company', () =>
        twenty.createNoteTarget({ noteId: note.id, companyId })
      );
    }
    if (personId) {
      await attempt('contact-note-target-person', () =>
        twenty.createNoteTarget({ noteId: note.id, personId })
      );
    }
  }

  /* --- Task --- */
  //
  // This body is read by an unattended routine as its brief, so every piece
  // of submitter-controlled text in it goes through mdInline. clean() keeps
  // newlines and backticks on purpose -- they are legitimate in a message
  // body -- which means an unescaped name here could inject fake headings and
  // instructions straight into Claude's work queue.
  const safeName = mdInline(input.fullName, 120);
  const safeEmail = mdInline(input.email, 320);
  const safeLabel = plainInline(companyLabel, 120); // title only: plain text in Twenty

  const taskLines = optedOut
    ? [
        'DO NOT CONTACT. This company is set to OPTED_OUT in the CRM.',
        safeName + ' (' + safeEmail + ') used the website contact form anyway.',
        '',
        'Read the "Contact form" Note. Take no outbound action without Joash.',
      ]
    : [
        safeName + ' (' + safeEmail + ') used the website contact form.',
        '',
        'Read the "Contact form" Note on the Company, then draft a reply.',
        input.consent ? 'They ticked consent.' : 'They did NOT tick consent -- reply only.',
      ];

  const task = await attempt('contact-create-task', () =>
    twenty.createTask({
      title:
        (optedOut ? '@claude OPTED OUT - do not contact: ' : '@claude Follow up contact: ') +
        safeLabel,
      status: 'TODO',
      dueAt: nextWorkingDay(new Date(receivedAt)).toISOString(),
      bodyV2: { markdown: taskLines.join('\n') },
      position: 'first',
    })
  );

  if (task?.id && companyId) {
    await attempt('contact-task-target-company', () =>
      twenty.createTaskTarget({ taskId: task.id, companyId })
    );
  }

  return { status: 200, body: { ok: true } };
}
