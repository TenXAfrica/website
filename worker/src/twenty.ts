/**
 * Minimal Twenty CRM REST client for the DMA Worker.
 *
 * Design rules, in priority order:
 *   1. The bearer token never leaves this module. It is not in any thrown
 *      error, any log line, or any response body. Everything that is logged
 *      goes through `redact()` first.
 *   2. Twenty's response envelope is decoded in exactly one place
 *      (`unwrapOne` / `unwrapMany`), so a shape change on the CRM side is a
 *      one-function fix rather than a hunt.
 *   3. Every call is bounded: 8s AbortController timeout, one retry on 5xx or
 *      a network failure, then give up. The caller decides what a failure
 *      means -- for lead capture it means "log and carry on".
 */

/* ------------------------------------------------------------------ */
/* Redaction                                                           */
/* ------------------------------------------------------------------ */

/**
 * Values registered here are scrubbed out of anything `redact()` renders,
 * wherever they appear. The Worker registers its secrets at request entry so
 * a token that leaks into, say, an upstream error body still never reaches a
 * log line.
 */
const REGISTERED_SECRETS = new Set<string>();

/**
 * Register a secret value for scrubbing. Short values are ignored.
 *
 * Also registers the JSON-escaped spelling, because `redact()` scrubs after
 * `JSON.stringify`: a secret containing a quote or a backslash appears in the
 * serialised text as `\"` or `\\` and would otherwise slip through the
 * literal match.
 */
export function registerSecret(value: string | undefined | null): void {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed.length < 8) return;

  REGISTERED_SECRETS.add(trimmed);

  const jsonEscaped = JSON.stringify(trimmed).slice(1, -1);
  if (jsonEscaped !== trimmed) REGISTERED_SECRETS.add(jsonEscaped);
}

/** Test seam. Not used by the Worker. */
export function clearRegisteredSecrets(): void {
  REGISTERED_SECRETS.clear();
}

const SENSITIVE_KEY =
  /(authorization|auth|token|secret|password|passwd|api[_-]?key|apikey|bearer|cookie|credential|signature)/i;

const BEARER_RE = /\b(bearer|token)\s+[^\s"',;}\]]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const REDACTED = '[redacted]';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactStructure(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    return value.map((v) => redactStructure(v, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[circular]';
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redactStructure(v, seen);
    }
    return out;
  }

  return value;
}

/**
 * Render anything as a log-safe string.
 *
 * Removes, in order: values under sensitive-looking keys, any registered
 * secret wherever it appears, `Bearer <...>` runs inside free text, and email
 * addresses (we log about leads, we do not log the leads themselves). The
 * result is truncated so a large upstream error body cannot flood the log.
 */
export interface RedactOptions {
  /**
   * Mask email addresses. On by default.
   *
   * Set false ONLY on the lead-recovery path, where the whole point of the
   * log line is to preserve the contact details of a lead the CRM refused to
   * accept. Registered secrets are still scrubbed either way.
   */
  maskEmails?: boolean;
}

export function redact(
  value: unknown,
  maxLen = 2000,
  options: RedactOptions = {}
): string {
  let text: string;
  try {
    const structured = redactStructure(value, new WeakSet<object>());
    text =
      typeof structured === 'string'
        ? structured
        : JSON.stringify(structured) ?? String(structured);
  } catch {
    text = '[unserialisable]';
  }

  for (const secret of REGISTERED_SECRETS) {
    text = text.replace(new RegExp(escapeRegExp(secret), 'g'), REDACTED);
  }

  text = text.replace(BEARER_RE, (_match, kind: string) => kind + ' ' + REDACTED);
  if (options.maskEmails !== false) {
    text = text.replace(EMAIL_RE, '[email]');
  }

  if (text.length > maxLen) {
    return text.slice(0, maxLen) + '...(+' + (text.length - maxLen) + ' more)';
  }
  return text;
}

/** Single logging entry point. Everything it prints is redacted. */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  detail?: unknown,
  options: RedactOptions = {}
): void {
  const line =
    detail === undefined
      ? '[dma] ' + event
      : '[dma] ' + event + ' ' + redact(detail, 2000, options);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Log a lead the CRM would not accept, with enough detail to re-enter it by
 * hand. Deliberately keeps the email address: a redacted copy of a lost lead
 * is not a recovery record, it is just a sad log line. Secrets are still
 * scrubbed.
 */
export function logLeadRecovery(event: string, detail: unknown): void {
  logEvent('error', event, detail, { maskEmails: false });
}

/* ------------------------------------------------------------------ */
/* Envelope decoding                                                   */
/* ------------------------------------------------------------------ */

export interface TwentyRecord {
  id: string;
  [key: string]: unknown;
}

function isRecordLike(v: unknown): v is TwentyRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { id?: unknown }).id === 'string'
  );
}

/**
 * Pull one record out of whatever Twenty returned.
 *
 * Handles, in order of preference:
 *   { data: { createCompany: { id } } }   <- documented REST shape
 *   { data: { company: { id } } }
 *   { data: { id } }
 *   { id }                                <- bare record
 *
 * ASSUMPTION worth verifying against the live CRM: the create endpoints wrap
 * in `data.create<Object>`. If that is wrong, this function is the only place
 * that needs to change.
 */
export function unwrapOne(json: unknown, hints: string[] = []): TwentyRecord | null {
  if (!json || typeof json !== 'object') return null;

  const root = json as Record<string, unknown>;
  const candidates: unknown[] = [];

  const data = root['data'];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataObj = data as Record<string, unknown>;
    for (const hint of hints) {
      if (hint in dataObj) candidates.push(dataObj[hint]);
    }
    candidates.push(data);
    // Last resort: a single-key envelope whose key we did not predict.
    const keys = Object.keys(dataObj);
    if (keys.length === 1) candidates.push(dataObj[keys[0] as string]);
  }

  for (const hint of hints) {
    if (hint in root) candidates.push(root[hint]);
  }
  candidates.push(root);

  for (const candidate of candidates) {
    if (isRecordLike(candidate)) return candidate;
  }
  return null;
}

/**
 * Pull a list of records out of whatever Twenty returned.
 *
 * Handles { data: { companies: [...] } }, { data: [...] }, and a bare array.
 */
export function unwrapMany(json: unknown, hints: string[] = []): TwentyRecord[] {
  if (!json) return [];
  if (Array.isArray(json)) return json.filter(isRecordLike);
  if (typeof json !== 'object') return [];

  const root = json as Record<string, unknown>;
  const candidates: unknown[] = [];

  const data = root['data'];
  if (Array.isArray(data)) {
    candidates.push(data);
  } else if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    for (const hint of hints) {
      if (hint in dataObj) candidates.push(dataObj[hint]);
    }
    const keys = Object.keys(dataObj);
    if (keys.length === 1) candidates.push(dataObj[keys[0] as string]);
  }
  for (const hint of hints) {
    if (hint in root) candidates.push(root[hint]);
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecordLike);
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_TWENTY_BASE_URL = 'https://crm.tenxafrica.co.za';
const DEFAULT_TIMEOUT_MS = 8_000;

export class TwentyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    // `message` is assembled in this module only, from already-redacted input.
    super(message);
    this.name = 'TwentyError';
    this.status = status;
  }
}

export interface TwentyConfig {
  baseUrl?: string;
  apiKey: string;
  /** Injected by tests. Defaults to the platform fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class TwentyClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: TwentyConfig) {
    this.baseUrl = (config.baseUrl || DEFAULT_TWENTY_BASE_URL).replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /* ---------------------------- transport --------------------------- */

  private async attempt(
    method: string,
    url: string,
    body: unknown
  ): Promise<{ status: number; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          // The one place the token is used. Never logged, never rethrown.
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      return { status: res.status, text };
    } finally {
      clearTimeout(timer);
    }
  }

  private async request(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string> } = {}
  ): Promise<unknown> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }
    const href = url.toString();

    let lastStatus = 0;
    let lastDetail = 'no response';

    for (let i = 0; i < 2; i++) {
      try {
        const { status, text } = await this.attempt(method, href, options.body);
        if (status >= 200 && status < 300) {
          if (!text) return null;
          try {
            return JSON.parse(text) as unknown;
          } catch {
            throw new TwentyError(status, method + ' ' + path + ': non-JSON response body');
          }
        }
        lastStatus = status;
        // `text` is an upstream body: redact before it goes anywhere.
        lastDetail = redact(text, 400);
        if (status < 500) break; // A 4xx will not get better on a retry.
      } catch (err) {
        if (err instanceof TwentyError) throw err;
        lastStatus = 0;
        // Never surface the raw error: it can carry request detail.
        lastDetail = redact(err, 200);
      }
    }

    throw new TwentyError(
      lastStatus,
      method + ' ' + path + ' failed (status ' + lastStatus + '): ' + lastDetail
    );
  }

  /* ------------------------------ reads ----------------------------- */

  /**
   * VERIFIED against crm.tenxafrica.co.za on 2026-09-22. The filter grammar
   * is `?filter=field[comparator]:value`, nested fields dotted, strings
   * quoted. Checked live: `emails.primaryEmail[eq]`, `name[eq]` and
   * `domainName.primaryLinkUrl[eq]` all return 200, and `title[ilike]:"%claude%"`
   * returned 2 of the 3 existing tasks -- so the filter is genuinely applied
   * rather than ignored, which is the failure mode that would have quietly
   * produced duplicate Companies and People.
   *
   * Also verified: the collection prefix is `/rest/<collection>`. The instance
   * OpenAPI description shows `/rest/core/<collection>` in its examples; that
   * path 400s here. Do not "fix" this to match those docs.
   */
  private async findFirst(
    collection: string,
    filter: string,
    hints: string[]
  ): Promise<TwentyRecord | null> {
    const json = await this.request('GET', '/rest/' + collection, {
      query: { filter, limit: '1', depth: '0' },
    });
    return unwrapMany(json, hints)[0] ?? null;
  }

  findCompanyByDomain(primaryLinkUrl: string): Promise<TwentyRecord | null> {
    if (!isFilterSafe(primaryLinkUrl)) return Promise.resolve(null);
    return this.findFirst(
      'companies',
      'domainName.primaryLinkUrl[eq]:"' + escapeFilterValue(primaryLinkUrl) + '"',
      ['companies']
    );
  }

  findCompanyByName(name: string): Promise<TwentyRecord | null> {
    if (!isFilterSafe(name)) return Promise.resolve(null);
    return this.findFirst(
      'companies',
      'name[eq]:"' + escapeFilterValue(name) + '"',
      ['companies']
    );
  }

  findPersonByEmail(email: string): Promise<TwentyRecord | null> {
    if (!isFilterSafe(email)) return Promise.resolve(null);
    return this.findFirst(
      'people',
      'emails.primaryEmail[eq]:"' + escapeFilterValue(email) + '"',
      ['people']
    );
  }

  /* ----------------------------- writes ----------------------------- */

  private async createOne(
    collection: string,
    hint: string,
    input: Record<string, unknown>
  ): Promise<TwentyRecord | null> {
    const json = await this.request('POST', '/rest/' + collection, { body: input });
    return unwrapOne(json, [hint, singular(collection), collection]);
  }

  createCompany(input: Record<string, unknown>) {
    return this.createOne('companies', 'createCompany', input);
  }

  createPerson(input: Record<string, unknown>) {
    return this.createOne('people', 'createPerson', input);
  }

  createOpportunity(input: Record<string, unknown>) {
    return this.createOne('opportunities', 'createOpportunity', input);
  }

  createNote(input: Record<string, unknown>) {
    return this.createOne('notes', 'createNote', input);
  }

  createNoteTarget(input: Record<string, unknown>) {
    return this.createOne('noteTargets', 'createNoteTarget', targetKeys(input));
  }

  createTask(input: Record<string, unknown>) {
    return this.createOne('tasks', 'createTask', input);
  }

  createTaskTarget(input: Record<string, unknown>) {
    return this.createOne('taskTargets', 'createTaskTarget', targetKeys(input));
  }

  async updateOpportunity(
    id: string,
    patch: Record<string, unknown>
  ): Promise<TwentyRecord | null> {
    const json = await this.request(
      'PATCH',
      '/rest/opportunities/' + encodeURIComponent(id),
      { body: patch }
    );
    return unwrapOne(json, ['updateOpportunity', 'opportunity']);
  }
}

function singular(collection: string): string {
  if (collection === 'people') return 'person';
  return collection.replace(/s$/, '');
}

/**
 * This workspace's noteTarget and taskTarget objects name their foreign keys
 * targetCompanyId / targetPersonId / targetOpportunityId (Twenty renamed them from
 * the older companyId / personId / opportunityId). Callers keep writing the short
 * names; this rewrites them so the link records actually land. Verified against
 * the live CRM on 23 Sep 2026: the short names are refused with a 400.
 */
const TARGET_KEY_MAP: Record<string, string> = {
  companyId: 'targetCompanyId',
  personId: 'targetPersonId',
  opportunityId: 'targetOpportunityId',
};

function targetKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[TARGET_KEY_MAP[key] ?? key] = value;
  }
  return out;
}

/**
 * Keep a user-supplied value from breaking out of a quoted filter term.
 *
 * Verified against the live CRM rather than guessed. Filtering a task whose
 * title contained "(DMA)":
 *
 *   title[eq] with parentheses intact             -> matched
 *   title[eq] with parentheses stripped           -> no match
 *   title[eq] with parentheses backslash-escaped  -> no match
 *
 * So Twenty handles commas, parentheses and ampersands correctly inside a
 * quoted value, and backslash-escaping actively breaks matching. Touching
 * them was a real bug: the write path stores the raw name, so "Acme, Inc"
 * could never match itself and created a duplicate Company on every single
 * resubmission.
 *
 * The only characters left to defend against are the two that could
 * terminate the quoted string.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/["\\]/g, '').trim();
}

/**
 * True when the value survives `escapeFilterValue` unchanged.
 *
 * When it does not, an `[eq]` lookup on the stripped value is not a weaker
 * lookup -- it is a different question, and it could match some *other*
 * record that happens to be named the stripped spelling. Callers skip the
 * lookup instead, which at worst creates a duplicate.
 */
export function isFilterSafe(value: string): boolean {
  return !/["\\]/.test(value) && value.trim().length > 0;
}
