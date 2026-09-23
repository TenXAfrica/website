# The Digital Maturity Assessment

The DMA is the front door of the business. It exists in two forms that share
one scoring model, and every build we sell starts from its output.

- **Self-serve score** — public, `/assessment`, 12 questions, under three
  minutes on a phone. A lead magnet that gives a real answer.
- **Guided full DMA** — internal, `/internal/dma`, ~30 questions, ~45 minutes.
  Any Ten X Africa team member signs in with Microsoft 365 (Cloudflare Access), looks the
  client up in the CRM, and fills it in while the owner talks. Its output becomes the build spec.

The rules — dimensions, weights, maturity anchors, bands, recommendation
logic, ROI maths, fit scoring, consent handling — are written up in
[`dma/rubric.md`](./rubric.md). Read that before changing anything here.

---

## How it fits together

```
 browser                        Cloudflare Worker              Twenty CRM
 ───────                        ─────────────────              ──────────
 /assessment  ──POST──────────▶ /api/dma/self-serve ─────────▶ Company
   (public, Turnstile)            verify Turnstile              Person
                                  validate payload              Opportunity (NEW)
                                  scoreSelfServe()              Note + note targets
             ◀──ScoreResult───                                  Task @claude Follow up

 /internal/dma ─GET/POST──────▶ /api/internal/dma/lookup ──────▶ (read) Company, People,
   (noindex, team only,            /api/internal/dma/session ─────▶ Opportunities, Notes
    Cloudflare Access +            /api/internal/dma/full ────────▶ Note on Opportunity
    Microsoft 365 sign-in)           verify Access token            Opportunity → QUALIFIED
                                     scoreFull()                    Task @claude Process DMA
```

The site is static (Astro → GitHub Pages), so there is no server at runtime.
Everything that needs a secret happens in the Worker.

### Source layout

| Path | What it is |
|---|---|
| `shared/dma/types.ts` | The data contract. Shared by site and Worker. |
| `shared/dma/questions.ts` | Question bank, dimension weights, build catalogue, bands. |
| `shared/dma/scoring.ts` | `scoreSelfServe()`, `scoreFull()`, `fitScoreFor()`. Pure functions. |
| `src/pages/assessment/` | The public self-serve page. |
| `src/components/dma/` | The React islands for both assessments. |
| `src/pages/internal/dma.astro` | The guided tool. `noindex`, not in the nav or sitemap. |
| `worker/` | The Cloudflare Worker. See [`worker/README.md`](../worker/README.md). |
| `scripts/push-worker-secret.ps1` | Pushes a secret into the Worker without printing it. |
| `dma/rubric.md` | The rules, in prose. |

`shared/dma/` is the single source of truth. If the site and the Worker ever
disagree about a score, one of them is not importing from there.

---

## Running it locally

```bash
npm install
npm run dev
```

Then `http://localhost:4321/assessment`.

With no Worker running, the assessment still works end to end: the result is
computed in the browser by the same `scoreSelfServe()` the Worker uses, and
the page shows a quiet line saying the result could not be saved. That is
deliberate — a lead magnet that dead-ends on a network error is worse than
one that never saved the lead.

To run the Worker alongside it:

```bash
cd worker
npm install
npx wrangler dev
```

Copy `worker/.dev.vars.example` to `worker/.dev.vars` and fill it in. That
file is gitignored and must stay that way.

Set `PUBLIC_DMA_WORKER_URL` in `.env` to point the site at your local Worker.

---

## Test submission

Use the Turnstile test key `1x00000000000000000000AA` (always passes) — it is
the default when `PUBLIC_TURNSTILE_SITE_KEY` is unset, so a local run needs
no setup.

To exercise the Worker directly without the browser:

```bash
curl -X POST http://localhost:8787/api/dma/self-serve \
  -H 'content-type: application/json' \
  -d @worker/test/fixtures/self-serve.json
```

Check afterwards that the CRM has a new Company, Person, Opportunity, Note
and a `@claude Follow up DMA score:` task. Delete the test records when you
are done — they will otherwise be picked up by the task runner and followed
up for real.

`GET /api/dma/health` returns `{ok:true}` and touches nothing.

---

## Secrets

The Twenty API bearer token lives on Joash's machine in `~/.claude.json`
under `mcpServers.twenty.headers.Authorization`. It is never committed, never
printed, and never pasted into a note or a chat.

To push it to the Worker:

```powershell
./scripts/push-worker-secret.ps1
```

The script reads the value, strips the `Bearer ` prefix and pipes it straight
into `wrangler secret put TWENTY_API_KEY` over stdin, so it never reaches the
console or your shell history. It prints only the name of what it pushed.

Secrets the Worker needs:

| Name | What for |
|---|---|
| `TWENTY_API_KEY` | Writing to the CRM |
| `TURNSTILE_SECRET_KEY` | Verifying the public form |
| `DMA_ADMIN_TOKEN` | Fallback guard for the internal routes where Cloudflare Access is not in front (local dev, workers.dev). On the live site the tool uses the Microsoft sign-in instead and nobody types this |

---

## Deploying

Production deploys are Joash's call, both for the site and the Worker.

- **Site** — merging to `main` triggers the GitHub Pages workflow. A
  production build falls back to the deployed Worker
  (`https://tenx-dma.ten-x-africa-main.workers.dev`) and the account's
  Turnstile site key when `PUBLIC_DMA_WORKER_URL` and
  `PUBLIC_TURNSTILE_SITE_KEY` are unset, so repository secrets are an
  override, not a prerequisite. See `src/components/dma/util.ts`.
- **Worker** — `npx wrangler deploy` from `worker/`. The KV namespace ids
  are in `wrangler.toml` and the Worker serves on its workers.dev hostname.
  First deployed 2026-09-22.

Nothing in this directory deploys itself, and no routine may deploy either
without Joash approving it first.

---

## Changing the questions

Question ids and answer option values are permanent. Rewording a question is
fine; reusing an id for a different question silently corrupts every
historical comparison. Add a new id and retire the old one.

Bump the `version` string in `types.ts` when the shape of the note JSON
changes, because the DMA Processor routine keys its parser off it.
