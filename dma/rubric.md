# Digital Maturity Assessment — scoring rubric and recommendation rules

Version 1.0 · 2026-09-22 · owner: Claude routines

This document is the human-readable statement of the rules. The executable
version is the single source of truth and lives in the website repo:

```
TenXAfrica/website
  shared/dma/types.ts      the data contract
  shared/dma/questions.ts  the question bank, weights, bands, build catalogue
  shared/dma/scoring.ts    scoreSelfServe(), scoreFull(), fitScoreFor()
```

If the two ever disagree, the code wins and this document is wrong. Any
routine that needs to score, re-score or interpret a DMA — in particular the
**DMA Processor** (`@claude Process DMA: <company>`) — must import those
modules rather than re-implement the arithmetic here.

---

## 1. What the DMA is for

The DMA is the front door of the business and the input to every build. It
does three jobs at once:

1. **For the prospect** — a straight answer to "how far behind are we, and
   what should we fix first", delivered without a sales call.
2. **For qualification** — enough signal to set `fitScore`, `signals` and
   `need` on the CRM record without a human reading anything.
3. **For delivery** — the guided version becomes the build spec. Sections 2,
   4, 5 and 6 of the readiness review (`ajojotank/tenx-company`
   `catalogue/review.md`) map onto the operations, data, people and sales
   dimensions below; section 9 becomes the acceptance criteria; section 10
   sets the client's own approval gates.

There are two versions and they share one scoring model:

| | Self-serve score | Full DMA |
|---|---|---|
| Where | Public, `tenxafrica.co.za/assessment` | Internal, `/internal/dma`, on the call |
| Length | 12 questions, under 3 minutes | ~30 questions, ~45 minutes |
| Who answers | The owner, alone, on a phone | Joash types while the owner talks |
| Maturity from | The option they pick | Interviewer sets it against the anchors |
| Output | Score + top 2 builds + booking CTA | Score + top 3 builds with ROI + spec input |
| Recommendations | 2 | 3 |
| Lands in CRM as | Company + Person + Opportunity (NEW) + Note | Note on the Opportunity, stage → QUALIFIED |

---

## 2. The six dimensions

Weights sum to 100. Operations and data carry the most because that is where
the five build types in `catalogue/builds.md` actually land — a business can
be weak on AI readiness and still get a large, fast win from a dashboard.

| Dimension | Weight | What it measures |
|---|---:|---|
| Sales and customer handling | 20 | What happens between someone asking and someone buying |
| Operations and delivery | 25 | How work gets done, tracked and handed over |
| Finance and admin | 15 | Invoicing, chasing, and the paperwork around the money |
| People and communication | 10 | How work passes between people; how new people start |
| Data and systems | 20 | Where records live; whether tools talk to each other |
| AI readiness | 10 | Whether the business can adopt this safely at all |

### Scoring

Every question scores **0 to 4**.

```
dimension score (0-100) = (sum of its question scores / (4 × question count)) × 100
overall score  (0-100) = Σ (dimension score × dimension weight) / Σ weights
```

Dimensions with no answered questions are dropped from both sums, so a
partial full DMA still produces an honest number rather than a deflated one.

### Maturity anchors (0-4)

The same ladder applies to every question. In the self-serve version it is
baked into the five answer options; in the full DMA the interviewer picks it.

| Score | Anchor | What it looks like |
|---:|---|---|
| 0 | Fully manual | Lives in someone's head, inbox or memory. No artefact. |
| 1 | Manual with notes | A person does it by hand, helped by a note or checklist they maintain. |
| 2 | Templated / semi-manual | There is a template, form or shared board, but a human drives every step. |
| 3 | System, manually driven | A real system holds the record, but somebody still has to push it along. |
| 4 | Runs itself | It happens without anyone remembering to do it. Humans handle exceptions. |

Two rules for the interviewer, because they are where scores drift:

- **Score what happens, not what is supposed to happen.** "We have a CRM" is
  a 1 if nobody updates it.
- **Score the weakest link in the flow.** A step is only as automated as its
  worst handoff. Re-keying anywhere caps the question at 2.

### Maturity bands

| Band | Range | What we tell them |
|---|---|---|
| Manual | 0–24 | Most of the business runs on people remembering things. Fragile, and also the easiest to fix — the first build usually pays for itself fastest here. |
| Emerging | 25–44 | You have tools, but they are mostly places to type things twice. The win is joining them up rather than buying more. |
| Connected | 45–64 | Core systems are in place and used. Hours now leak at the handoffs between them. |
| Streamlined | 65–84 | Most routine work moves without being pushed. What is left is judgement and exceptions. |
| Optimised | 85–100 | Ahead of almost every business your size. Remaining gains are in decision support, not admin. |

Bands are deliberately generous at the bottom: a manual business should read
its result as an opportunity, not an insult. Nothing in the copy calls the
business or the owner behind, careless or at risk.

---

## 3. The self-serve question bank

Twelve questions, two per dimension, one per screen on a phone. Option order
is always most manual (0) to most automated (4) so the group reads as a
scale.

| id | Dimension | Question |
|---|---|---|
| s1 | Sales | A new enquiry arrives. What happens next? |
| s2 | Sales | How do you put a quote or proposal together? |
| o1 | Operations | How do you find out where a job has got to? |
| o2 | Operations | Across the whole business, how many hours a week go on repeat admin? |
| f1 | Finance | How do invoices get raised and chased? |
| f2 | Finance | From the work being finished, how long until the invoice goes out? |
| p1 | People | How does work get handed from one person to the next? |
| p2 | People | What happens when you take on a new client? |
| d1 | Data | Where do your customer records actually live? |
| d2 | Data | Do your main tools pass information to each other? |
| a1 | AI | Has anyone in the business used AI tools for real work? |
| a2 | AI | Could someone new follow your processes from what is written down? |

`o2` is the only question that carries an hours estimate, and it is the one
the whole ROI calculation hangs off. Its options map to 20, 12.5, 7.5, 3.5
and 1 hours per week — the midpoint of each stated band, and the bottom of
the open-ended top band rather than the top, because self-reported admin time
is optimistic often enough that we would rather be under.

**Question ids are permanent.** Changing the wording of a question is fine.
Reusing an id for a different question, or an option value for different
wording, silently corrupts every historical comparison. Add `s3`, retire `s1`.

---

## 4. The full DMA question set

Five questions per dimension, thirty in all, all open-ended. Each one is
captured against six fields:

| Field | Type | Why |
|---|---|---|
| `current` | text | How it is done today, in the owner's words. Becomes the spec. |
| `tools` | text | What they name. Becomes the integration list. |
| `owner` | text | Who does it. Becomes the handover and training plan. |
| `hoursPerWeek` | number | Across the business, not per person. Drives ROI. |
| `pain` | 1–5 | 1 = fine, 5 = actively painful. Drives prioritisation. |
| `maturity` | 0–4 | Set by the interviewer against the anchors above. Drives the score. |

Plus a free-text `notes` block per dimension for everything that does not fit
a field — which, in practice, is where the best material for the report ends
up.

Hours are recorded **across the business**, not per person. Ask "if I added
up everyone who touches this, how many hours a week is it?" Getting this
wrong is the single largest source of error in the ROI numbers, because it
propagates into every recommendation.

---

## 5. Recommendation rules

The five build types are the only things we quote in year one
(`catalogue/builds.md`). The DMA never recommends anything outside this list.

| id | Build | Catalogue size | Automation factor |
|---|---|---|---:|
| `intake_portal` | Client intake and onboarding portal | medium | 0.70 |
| `quote_to_invoice` | Quote-to-invoice automation | medium | 0.75 |
| `ops_dashboard` | Operations dashboard | medium | 0.50 |
| `doc_generation` | Document generation | small | 0.80 |
| `inbox_triage` | Inbox triage and routing | medium | 0.60 |

The **automation factor** is the share of the hours attributed to a build
that the build actually removes. These are deliberately conservative.
`ops_dashboard` is lowest because a dashboard removes the asking and the
reporting, not the work itself; `doc_generation` is highest because
generating a document from a template and live data is very nearly complete
replacement of the task.

### Self-serve: how a build gets recommended

Each answer option carries weights pointing at build types — a business whose
enquiries sit in a shared inbox until someone notices scores `inbox_triage: 3,
intake_portal: 1`. Weights accumulate across all twelve answers. The two
heaviest build types are recommended, with `strength` expressed relative to
the heaviest, and `drivers` listing the dimensions that argued for them.

Only the *manual* options carry weights. A business that answers 4 on
everything gets a high score and no recommendations, which is the correct
outcome: we have nothing to sell them and should say so.

### Full DMA: how a build gets recommended

The questions are open-ended, so weights come from a fixed per-dimension
affinity scaled by how much that question actually hurts:

```
manualness = (4 − maturity) / 4
intensity  = hoursPerWeek × (pain / 5) × manualness
weight(build) = dimension affinity for that build × intensity
```

This means a question only pulls a build up if it costs real hours **and**
the owner says it hurts **and** it is currently manual. A painful process
that is already automated contributes nothing, which is right — there is no
build to sell against it.

Dimension affinities:

| Dimension | Builds it argues for |
|---|---|
| Sales | inbox_triage 2, doc_generation 2, quote_to_invoice 1 |
| Operations | ops_dashboard 3, intake_portal 1 |
| Finance | quote_to_invoice 3, doc_generation 1 |
| People | intake_portal 3, inbox_triage 1 |
| Data | ops_dashboard 2, intake_portal 1, quote_to_invoice 1 |
| AI readiness | doc_generation 1 |

Top **three** are recommended, each with ROI.

### ROI

```
share          = (this build's weight / total weight of recommended builds) × total hours per week
hours recovered/week = share × automation factor
annual hours   = hours recovered × 48 working weeks
annual value   = annual hours × blended hourly rate (USD)
```

48 weeks, not 52 — four weeks off, and we would rather the number be
defensible than large. The blended hourly rate defaults to **USD 25** and is
set explicitly by the interviewer on the full DMA. The self-serve result page
shows **hours only, never money**: we have not asked what an hour costs them,
so any figure would be invented.

ROI is an estimate built on a number the owner gave us in a three-minute
quiz. Present it as "about X hours a week back", never as a guarantee, and
never as a payback period. The real number comes out of the call.

---

## 6. Pricing

Approved tiers (2026-09-22, USD), from `CLAUDE.md`:

| Tier | Build | Retainer |
|---|---|---|
| Launch | $2,500 – $4,500 | $249/mo |
| Growth | $6,500 – $12,000 | $649/mo |
| Scale | $15,000 – $28,000 | $1,450/mo |

Mapping from a recommendation to a band:

- catalogue size `small`, company under 51 staff → **Launch**
- catalogue size `medium` → **Growth**
- catalogue size `medium`, company 51+ staff → **Scale**

A recommendation never jumps a band on its own. Tiers are anchors: the DMA
call produces a tailored fixed price inside the matching band.

**The self-serve result page shows no price at all.** The ask on a first
touch is the assessment, never a number.

---

## 7. Fit score and CRM signals

`fitScore` (Twenty `RATING_1`..`RATING_5`) is "evidence of pain, ability to
pay, fit to what we sell". It starts at 1 and adds:

| Factor | Points |
|---|---:|
| Overall score under 45 (plenty to fix) | +2 |
| Overall score 45–64 | +1 |
| Overall score 65–84 | 0 |
| Overall score 85+ (nothing to sell) | −1 |
| Size 6–20 or 21–50 staff (our ICP) | +2 |
| Size 51–200 | +1 |
| Size 1–5 (cannot fund a build) | −1 |
| Size 200+ (outside the ICP) | −1 |
| Country in US, UK, IE, AU, NZ, UAE | +1 |

Clamped to 1–5. Note that **low maturity raises fit** — a manual business is
a better prospect than an optimised one, because there is something to build.

`Company.signals` are set from the answers that justify them, not guessed:
`MANUAL_ADMIN` from any fully-manual answer, `SLOW_RESPONSE` from enquiries
sitting unanswered, `HIRING_ADMIN` from 15+ hours a week of repeat admin,
`NO_BOOKING` from ad-hoc client onboarding.

### Consent

The self-serve form carries an explicit tick: *"Ten X Africa may email me
about my results."* Ticked → `contactConsent: CONSENTED`. Unticked but
submitted → `ASKED`, and they get their result on screen and nothing else.

Inbound submission is not an invitation to run the three-touch cold sequence.
These people asked us a question; they get an answer and one follow-up. South
African records remain under POPIA s69 regardless of how they arrived. Any
opt-out sets `contactConsent: OPTED_OUT` permanently.

---

## 8. What lands in the CRM

### Self-serve submission

| Record | Key fields |
|---|---|
| Company | name, domainName, size, sector, `address.addressCountry`, `signals[]`, `fitScore`, `relationship: PROSPECT`, `contactConsent` |
| Person | name, primary email, `companyId`, `decisionRole: DECISION_MAKER` |
| Opportunity | `stage: NEW`, `source: INBOUND`, `serviceLine: AI_SYSTEM`, `dealType: PROJECT`, `need` = their stated time-sink, `nextStep: Book the full Digital Maturity Assessment` |
| Note | "DMA self-serve score: &lt;Company&gt; (&lt;n&gt;/100)" — all answers, all scores, both recommendations. Linked to company, person and opportunity. |
| Task | "@claude Follow up DMA score: &lt;Company&gt;", TODO, due next working day |

Existing Company (matched on domain, else name) and Person (matched on
primary email) are reused rather than duplicated.

### Full DMA submission

| Record | Key fields |
|---|---|
| Note | "DMA (full): &lt;Company&gt;" on the Opportunity — markdown report **and** a fenced `json` block holding `{version, submission, result}` |
| Opportunity | `stage` → `QUALIFIED` |
| Task | "@claude Process DMA: &lt;Company&gt;", TODO, due tomorrow |

### The note JSON contract

The DMA Processor reads the fenced `json` block, not the prose. It is:

```json
{
  "version": "dma-full-1",
  "submission": { "...": "the FullSubmission exactly as posted" },
  "result": { "...": "the ScoreResult as computed by scoreFull()" }
}
```

`version` is how the processor knows which parser to use. Bump it if the
shape of `submission` or `result` changes in a way an old parser would get
wrong. The self-serve equivalent is `dma-selfserve-1`.

---

## 9. From DMA to build spec

What the processor produces from a full DMA, in order:

1. **The scored report** — overall, six dimensions, band, what each means.
2. **Top three opportunities with ROI** — build type, what it replaces, hours
   back a week, annual hours, annual value at the stated rate, price band.
3. **The build spec** — from `catalogue/review.md`: the named flows and their
   owners (operations), where records live (data), the handoffs and re-keying
   points (people and data), and the decision points that are rules versus
   judgement (sales and operations). These are sections 2, 4, 5 and 6.
4. **Acceptance criteria** — the baseline numbers the client gave us, which
   the build has to beat. Section 9.
5. **Gates** — what may run unattended versus what needs the owner's
   approval, expressed inside the client's own tool. Section 10.
6. **The proposal** — one build, priced in its band, plus the retainer.

Every one of those is an Outlook **draft** until Joash approves it.

---

## 10. Changing these rules

- Change the code first, in `shared/dma/`. Update this document in the same
  commit.
- Never reuse a question id or an option value for different wording.
- Bump the `version` string when the note JSON shape changes.
- Scores are not comparable across weight changes. If the dimension weights
  move, say so in the run log, because trend lines across clients break.
- The rules that are not negotiable: no price on a first touch, no money
  figure on the self-serve result, hours estimated conservatively, and no
  recommendation outside the five catalogue build types.
