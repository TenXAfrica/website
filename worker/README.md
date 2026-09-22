# DMA intake Worker

Cloudflare Worker that receives Digital Maturity Assessment submissions, scores
them with the shared scorer, and writes the result into the self-hosted Twenty
CRM at `crm.tenxafrica.co.za`.

It is the only server-side piece of the website. The site itself is static
(Astro on GitHub Pages), so anything that needs a secret lives here.

## The rule that outranks the others

**Never lose a lead.** A missing KV binding, a slow CRM, a failed note target
— all of those log a redacted warning and carry on. Only two things are
allowed to reject a submission: a failed Turnstile check, and a payload that
does not validate. Everything downstream of scoring is best-effort, because a
lead half-written into Twenty is worth far more than a lead rejected because a
`noteTargets` POST returned a 500.

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/dma/self-serve` | Turnstile + 5/IP/hour | Public. Body is `SelfServeSubmission`. |
| `POST` | `/api/dma/full` | `Authorization: Bearer $DMA_ADMIN_TOKEN` | Internal. Body is `FullSubmission`. No Turnstile. |
| `POST` | `/api/contact` | Turnstile + 5/IP/hour | Public. Contact-form passthrough. |
| `GET` | `/api/dma/health` | none | `{ok: true, version}`. No secrets, ever. |

### `POST /api/dma/self-serve`

Validates the payload defensively (it is public browser input), scores it with
`scoreSelfServe`, then writes, in order and tolerating partial failure:

1. **Company** — reused if one already matches on domain or name, otherwise
   created with `size`, `sector`, `signals`, `fitScore`, `relationship:
   PROSPECT`, `address.addressCountry`, and `contactConsent` set to
   `CONSENTED` when they ticked the box and `ASKED` when they did not.
2. **Person** — reused if one already has that primary email, otherwise
   created and linked to the Company as `DECISION_MAKER`.
3. **Opportunity** — `"<Company> — Digital Maturity Score <overall>"`, stage
   `NEW`, source `INBOUND`, service line `AI_SYSTEM`, deal type `PROJECT`.
   `need` is their own words for the biggest time-sink, falling back to the
   top recommendation.
4. **Note** — the human-readable score report, then three `noteTargets`
   linking it to the Company, the Person and the Opportunity.
5. **Task** — `"@claude Follow up DMA score: <Company>"`, `TODO`, due the next
   working day, plus task targets on the Company and Opportunity.

The response is `{ok: true, result: ScoreResult}` and nothing else. **No CRM
ids are ever returned to the browser**, so the result page renders without a
second round trip and without learning anything about the CRM.

### `POST /api/dma/full`

Scores with `scoreFull`, writes a Note titled `"DMA (full): <companyName>"`
containing both a readable report **and** a fenced ` ```json ` block holding
`{version, submission, result}`, attaches it to the Opportunity (and the
Company when `companyId` was given), PATCHes the Opportunity to `QUALIFIED`,
and raises `"@claude Process DMA: <companyName>"`.

The `@claude Process DMA` routine parses that JSON block, so `src/notes.ts`
escapes backticks inside the payload as ```. An interviewer who pastes a
code fence into their notes cannot close the block early, and the routine's
`JSON.parse` still sees the original text. There is a test for exactly this.

## Secrets

Three, all pushed as Wrangler secrets and none of them in any file here:

| Name | What it is |
| --- | --- |
| `TWENTY_API_KEY` | Bearer token for the Twenty REST API. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side key. |
| `DMA_ADMIN_TOKEN` | Shared bearer protecting `/api/dma/full`. |

Push them with the script in `../scripts`, which reads the Twenty token
straight out of `%USERPROFILE%\.claude.json` and pipes it to Wrangler on
stdin, so it never reaches the console, a file, or shell history:

```powershell
pwsh scripts/push-worker-secret.ps1                            # TWENTY_API_KEY
pwsh scripts/push-worker-secret.ps1 -Name TURNSTILE_SECRET_KEY # prompts, masked
pwsh scripts/push-worker-secret.ps1 -Name DMA_ADMIN_TOKEN      # prompts, masked
pwsh scripts/push-worker-secret.ps1 -Env staging               # non-default env
```

It prints exactly `pushed <NAME>` and nothing else.

`src/twenty.ts` exports `redact()`, and every log line in the Worker goes
through it. It strips values under sensitive-looking keys, any registered
secret wherever it appears, `Bearer <...>` runs inside free text, and email
addresses. The Worker registers all three secrets at request entry, so a token
echoed back inside an upstream error body still cannot reach a log line.
`TwentyError` messages are built only from redacted input.

For local development copy `.dev.vars.example` to `.dev.vars` — which is
gitignored — and put throwaway values in it.

## Before the first deploy

Two placeholders in `wrangler.toml` need real values:

```bash
cd worker
npx wrangler kv namespace create DMA_RATELIMIT
npx wrangler kv namespace create DMA_RATELIMIT --preview
```

Paste the two ids over `REPLACE_WITH_KV_NAMESPACE_ID` and
`REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID`. Until then the Worker still runs: a
missing binding logs `ratelimit-binding-missing` and allows the request.

Then uncomment the `[[routes]]` blocks at the bottom of `wrangler.toml` to
attach `/api/*` on the apex and `www` hostnames.

## Rate limiting

Five submissions per IP per hour, per bucket (`selfserve` and `contact` are
counted separately), in KV with a one-hour TTL.

KV has no atomic increment, so a burst of simultaneous requests can slip past
the cap. That is the right trade: this exists to blunt a script, not to be a
ledger. Every failure mode — missing binding, KV error, corrupt counter —
allows the request.

## CORS

Allowed: `https://tenxafrica.co.za`, `https://www.tenxafrica.co.za`, any
`*.pages.dev` preview, and `http://localhost:4321` for `astro dev`. `OPTIONS`
preflight is handled; anything else gets a 403 with no CORS headers.

A request with **no** `Origin` header is allowed through, because that is what
server-to-server callers look like — `curl`, and Joash's internal DMA tool.
Those are gated on the admin bearer instead.

## Commands

```bash
npm install
npx vitest run     # 158 tests, no network
npm run typecheck  # tsc --noEmit
npm run dev        # wrangler dev, needs .dev.vars
```

## Tests

Pure functions only; nothing touches the network. Every test that needs
`fetch` injects its own stub, and the Twenty client takes a `fetchImpl` for
exactly that reason.

- `redact.test.ts` — the token never survives a log line, however it is
  nested, prefixed or echoed back; plus response-envelope decoding.
- `validate.test.ts` — the payload validators: unknown question ids, option
  values borrowed from another question, over-long strings, malformed emails,
  missing consent, unknown company sizes, out-of-range pain and maturity.
- `scoring.test.ts` — integration over the shared scorer: a fully manual
  business scores 0 and rates a strong fit; a manual sales-and-finance profile
  recommends quote-to-invoice and inbox triage; a fully automated one scores
  100 and recommends nothing.
- `notes.test.ts` — markdown rendering, escaping of hostile free text, and the
  JSON block round-tripping for the processing routine.
- `router.test.ts` — CORS allowlist, the constant-time admin bearer check,
  Turnstile verification, rate limiting, and the client's timeout and retry.

## Layout

```
src/index.ts     router, CORS, Turnstile, rate limit, admin bearer
src/twenty.ts    Twenty REST client, redact(), envelope decoding
src/selfserve.ts self-serve validator + CRM write sequence, contact handler
src/full.ts      full-DMA validator + handler
src/notes.ts     markdown and JSON note rendering
```

Types, the question bank and the scorer are **not** here. They live in
`../shared/dma/` and are shared with the Astro front end. That directory is a
contract: add fields, never rename them, and do not change it from this
Worker.
