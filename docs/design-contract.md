# Ten X Africa — Design Contract

Branch: `rebuild-2026-09` · Status: binding · Date: 23 September 2026

This is the specification the rebuild is built against. Every statement here is a decision,
not a suggestion. If a decision turns out to be wrong, change this file first, then the code.
A reviewer rejects work that contradicts this document.

---

## 1. Positioning and the hero sentence

### Positioning

Ten X Africa builds and runs the software an owner-led business of 5–50 people is currently
faking with spreadsheets, inboxes and someone's memory. We do one free 45-minute Digital
Maturity Assessment, come back with a fixed price and a spec, build the first working draft
ourselves, walk the owner through it, change what they want changed, deploy it, and then keep
it running on a monthly retainer. The output is a system the business owns — an intake portal,
a quote-to-invoice flow, an operations dashboard, a document generator, an inbox router — not a
strategy deck and not another subscription seat. Priced in USD, sold to the US, UK and Ireland,
Australia and New Zealand, the UAE and South Africa. One founder, Joash Paul, is in the room for
the assessment and the walkthrough; the rest is delivery.

### The one hero sentence

> **We build the software your business is currently doing by hand.**

Sub-line directly under it, in muted text, one sentence only:

> Intake, quotes, invoices, reporting, document packs, inbox triage — built for how your
> business actually runs, then kept running for you. Start with a free 45-minute assessment.

**Rules for the hero.** No second headline. No rotating words. No typewriter effect. No counter.
No "AI" in the H1 or the sub-line. The only two controls are `Take the 3-minute score` (to
`/assessment`) and `Book the 45-minute assessment` (to the Bookings link). There is no third
call to action anywhere on the site.

---

## 2. Art direction

### What this site is

A **trade publication for one trade**. Think a well-set technical journal or a good annual
report: black page, hairline rules, a hard left edge that every heading and paragraph hangs
off, generous vertical air, and drawings that carry information. The page is quiet so that the
one piece of colour and the one diagram per section land. Reading the home page should feel
like reading a competent memo from someone who has already done the work, not like being sold
to.

**The five things that carry the design:**

1. **Type.** Headline sizes are large and tight; body is set at a comfortable 17–18px with a
   short measure. Hierarchy comes from size and weight, never from colour or a box.
2. **Rules.** A 1px hairline (`--rule`) separates sections and table rows. Rules replace cards.
   A card is only used where something is genuinely a discrete object (a build type, a plan, an
   insight). Everywhere else, a rule and whitespace do the job.
3. **The left edge.** All text on a page starts on one vertical line. Nothing is centred except
   the home hero and the 404. Centred paragraph blocks are banned.
4. **Diagrams.** Every section that explains a mechanism gets a hand-specified SVG line drawing
   (section 7), monochrome with one gold element. They are drawn to the grid, not sketched.
5. **Numbers.** Where a claim can be a number — 7 steps, 5 build types, 3 plans, hours per week,
   days to first draft — it is set as a number in the display face, not as an adjective.

### Motion

Motion is limited to three things: a 150ms colour/border transition on hover and focus, a
200ms opacity-only fade for content that enters on scroll (once, never on re-entry), and the
existing 400ms progress-bar width transition inside the assessment. No parallax, no scroll-jacking,
no counters that tick up, no elements that translate more than 8px, no canvas, no WebGL, no
`framer-motion` layout animations. `framer-motion` stays in `package.json` only for the
components that survive; if nothing needs it after the rebuild, remove it.

### We do not do this

Each of these is a rejection reason on its own.

| Banned | Why |
|---|---|
| Gradient-blob or aurora hero, mesh gradients, animated particle/constellation canvas | This is exactly what `CanvasHero.tsx` and `NetworkCube.tsx` do today. It is the single strongest "generated site" tell. |
| Glassmorphism — `backdrop-blur`, translucent panels, glossy top-edge highlight | `GlassCard.tsx` and `.glass-panel` are deleted. Panels are flat. |
| Purple, violet, indigo, cyan, neon, or any two-colour gradient on text or buttons | Not in the palette. One accent only. |
| Stock photography of people — teams at laptops, handshakes, "African business woman smiling", city skylines | `src/assets/catalyst.jpg`, `consulting.jpg` and `impact.jpg` are deleted and not replaced. |
| Generic 3D renders, isometric illustration packs, floating UI cards in perspective | Diagrams are flat 2D line art drawn by us. |
| Africa silhouettes, map pins, circuit-board-as-continent, glowing network globes | `AfricaMap.tsx`, `OutlineMap-Africa.svg`, `circuit-tree.svg` are deleted. The logo is the only mark that uses this idea, and it is small. |
| Robot, brain, neuron, chip, sparkle or "✨" iconography | We sell working software, not the idea of AI. |
| Terminal/hacker chrome — fake prompts, blinking cursors, typing animations, chat-bot framing of a form | `TerminalFormChat.tsx`, `DigitalConsultingChat.tsx` and `TerminalLayout.astro` are deleted. A form is a form. |
| Marketing-number theatre — animated stat counters, "10x", "500+ projects", trust-logo bars we have not earned | `StatsCounter.tsx` is deleted. We have no client logos yet; we do not fake a row of them. |
| Venture studio, incubation, funding, impact investment, portfolio, partner network, applications, "backing the bold" | Out of the business. Every file listed in section 6 goes. |
| Decorative emoji in headings, buttons or nav | Icons are a small inline SVG set or nothing. |
| An interstitial "Get Started" modal on load | `GetStartedModal.tsx` / `GetStartedModalController.tsx` are deleted. The page has a CTA; it does not ambush. |
| Rounded corners above 4px, drop shadows, pill buttons | Radius is 2px. There are no shadows on a dark page; shadow is replaced by a rule or a 1-step surface lift. |
| The words: *unlock, unleash, empower, seamless, cutting-edge, revolutionise, game-changer, leverage, synergy, transform your business, in today's fast-paced world, journey, solutions* | Plain English only. Write "we build it and run it", not "we empower your transformation journey". |
| "AI" more than twice on any single page, or at all in an H1 | Joash's instruction. Say what the software does. |

---

## 3. Colour

### Theme decision: stay dark. One theme. No toggle.

The current site is dark and it stays dark, for three reasons.

1. **The assessment is already dark and must not be rebuilt.** `src/components/dma/**` is 3,762
   lines across 13 files carrying roughly 200 colour utilities keyed to white-on-obsidian
   (`text-vapor-white`, `border-white/10`, `bg-black/30`, `text-white/55` and so on). Flipping
   the site to light means rewriting every one of them — that is a rebuild, which the brief
   forbids. Dark lets the assessment be restyled by token substitution and spacing, not rewritten.
2. **The accent only works on dark.** `#d68614` on `#0a0f14` is **6.66:1** — it can carry text,
   rules and icons anywhere. The same gold on white is **2.89:1** and fails as text entirely,
   which would demote the one brand colour we have to a background swatch.
3. **A dark page makes the restraint visible.** The problem with the current site is not that it
   is dark, it is that it is *glassy* — blur, glow, gradient, canvas. Removing all of that from a
   black page produces exactly the editorial feel Joash asked for: it reads as ink on a printed
   black page, and the whitespace reads as deliberate rather than empty.

Light appears in exactly two places, both local and both justified: the **paper plate** that
holds product screenshots (section 7), and the existing **print stylesheet** in
`src/pages/assessment/index.astro`, which already flips to ink on paper. There is no
`prefers-color-scheme` branch and no theme switch. One theme means one contrast matrix to audit.

### Token set

All tokens are declared in `src/styles/global.css` under `@theme` (Tailwind 4) and mirrored in
`tailwind.config.mjs` only if a plugin needs them. Every contrast figure below is against
`--color-ink-900` (`#0a0f14`) unless stated.

**Keep — unchanged:**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-obsidian-void` | `#0a0f14` | Page background. The only background for full-width areas. | — |
| `--color-tenx-gold` | `#d68614` | The single accent. Taken straight from the logo mark. | 6.66:1 |
| `--color-vapor-white` | `#F4F4F9` | Primary text, headings. | 17.6:1 |

Keep the existing names. Renaming them means touching all 3,762 lines of the assessment for
no visual gain.

**Add:**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-gold-hover` | `#e59c34` | Hover/active state of gold surfaces. Already in the assessment CSS. | 8.37:1 |
| `--color-gold-ink` | `#8a5a0d` | Gold on a light surface only — the paper plate and print. Never on obsidian. | 5.40:1 on `#F4F4F9` |
| `--color-text-muted` | `#8E969F` | Body copy that sits under a heading, lede sub-lines, captions at ≥1rem. | 6.43:1 |
| `--color-text-faint` | `#7B848E` | Eyebrow labels, metadata, footer links, table sub-labels. The dimmest text allowed. | 5.07:1 |
| `--color-surface-1` | `#111820` | One-step lift: a card, a table header row, the sticky nav backdrop (solid, not blurred). | — |
| `--color-surface-2` | `#161E27` | Two-step lift: an inset code/detail block inside a card. Used sparingly. | — |
| `--color-rule` | `#1E262E` | Decorative hairlines: section dividers, table rows, card borders. | — |
| `--color-border-interactive` | `#57616B` | The border of any control whose boundary is the only thing marking it (inputs, secondary buttons, unselected answer cards). | 3.05:1 — meets the 3:1 non-text minimum |
| `--color-paper` | `#F4F4F9` | The screenshot plate background. | — |
| `--color-paper-ink` | `#12171C` | Text on the paper plate. Already used by the print stylesheet. | 16.4:1 on paper |
| `--color-signal-bad` | `#ffb4a2` | Error text. Already used in `SelfServeAssessment.tsx`. | 11.3:1 |
| `--color-signal-good` | `#7FD1A7` | Success/confirmation text. | 10.6:1 |

**Drop:**

| Token | Why |
|---|---|
| `--color-slate-teal` `#2F4858` | Unused as text, and as a surface it is a second accent competing with gold. Gone. |
| `red: '#FF0000'` in `tailwind.config.mjs` | Pure red, fails on dark, superseded by `--color-signal-bad`. Delete the line. |
| `backgroundImage.glass-gradient` | The glassmorphism overlay. Delete the key. |
| `.glass-panel` in `global.css` | Same. Delete the rule. |

### How sparingly gold is used

Gold is a **signal, not a surface.** The rule is one gold element per viewport-height of
scrolling, and never two gold things competing in the same eye-line.

Gold is allowed on:

- the primary button fill (gold background, `#0a0f14` text — 6.66:1);
- one word or number inside a heading, at most once per page;
- the active state of a nav item, a selected answer card, and a focus ring;
- the single "live" element of a diagram: the current step in the pipeline, the highlighted
  plan, the one arrow that matters;
- list markers in long-form prose (the existing `.legal-content li` rule), and inline links.

Gold is forbidden on: body paragraphs, more than one heading per page, every card border (the
current `GlassCard` does this and it is why nothing reads as important), icon sets, background
fills larger than a button, and any decorative divider. If a page has more than **five** gold
elements visible at once, it is rejected.

---

## 4. Typography

### Families: both stay

**Outfit** for display and headings, **Inter** for body and UI. They stay because they are
already loaded, already preconnected, and they are the right pairing for this job — Outfit is a
geometric sans that holds up tight at large sizes, Inter is the most readable UI face at 17px.
Changing them buys nothing and costs a font-loading regression.

**Drop Space Grotesk.** It is declared as `font-sys` in `tailwind.config.mjs`, is not loaded by
`MainLayout.astro`, and was only ever there for the terminal chrome that is being deleted.
Remove the `sys` key.

**Loading.** Keep the current strategy — preconnect, `media="print"` swap, `<noscript>` fallback,
and the `size-adjust` fallback `@font-face` blocks that stop the layout shifting. Narrow the
requested weights to what we actually use: `Inter:wght@400;500;600` and `Outfit:wght@600;700`.
Dropping Inter 300 and Outfit 400/800 removes two files from the critical path. Inter 300 is
banned as body text on a dark page anyway — thin weights on black smear.

### Scale — mobile first

Mobile values are the base. Every `clamp()` below is written so the mobile value *is* the
minimum, and the upper bound is reached at roughly the 1024px breakpoint. Desktop never gets a
separate rule for type; the clamp handles it.

| Token | Size | Line height | Tracking | Weight / face | Used for |
|---|---|---|---|---|---|
| `display` | `clamp(2.25rem, 9vw, 4rem)` | `1.05` | `-0.02em` | Outfit 700 | Home hero H1 only |
| `h1` | `clamp(1.875rem, 7.5vw, 3rem)` | `1.1` | `-0.015em` | Outfit 700 | Every other page H1 |
| `h2` | `clamp(1.5rem, 5.5vw, 2rem)` | `1.2` | `-0.01em` | Outfit 600 | Section headings |
| `h3` | `clamp(1.25rem, 4.5vw, 1.5rem)` | `1.3` | `0` | Outfit 600 | Card titles, step titles |
| `lede` | `clamp(1.125rem, 3.6vw, 1.25rem)` | `1.55` | `0` | Inter 400 | The one paragraph under an H1 |
| `body` | `1.0625rem` → `1.125rem` at ≥1024px | `1.65` | `0` | Inter 400 | All prose |
| `small` | `0.9375rem` | `1.6` | `0` | Inter 400 | Card body, table cells, form help |
| `caption` | `0.8125rem` | `1.45` | `0` | Inter 400 | Figure captions, footnotes, price footnotes |
| `label` | `0.75rem` | `1.2` | `0.14em`, uppercase | Outfit 600 | Eyebrows, nav CTA, button text, table headers |

**Hard floor: nothing renders below `0.75rem` (12px).** The current assessment uses `text-[9px]`,
`text-[10px]` and `text-[11px]` in 38 places — every one of those is raised to `0.75rem` during
the restyle. Twelve pixels is the smallest size that survives a phone at arm's length and an
accessibility audit at the same time.

**Measure.** Prose is capped at `34rem` (about 62 characters at 17px) on mobile and `38rem`
(about 68 characters at 18px) from 1024px. No paragraph runs the full 12-column width. Headings
may run to `20rem` / `28rem` for display and `28rem` / `44rem` for h1–h2 — a headline that fills
the viewport width edge to edge reads as a banner, not a sentence.

**Casing.** Uppercase is reserved for the `label` token and button text. Headings are sentence
case. No `text-transform` on anything longer than four words.

---

## 5. Spacing, grid and breakpoints

### Base unit: 4px

Scale, in rem: `0.25 · 0.5 · 0.75 · 1 · 1.5 · 2 · 3 · 4 · 6 · 8` (4, 8, 12, 16, 24, 32, 48, 64,
96, 128px). Nothing off this scale. Tailwind's `1 2 3 4 6 8 12 16 24 32` map onto it directly.

### Gutters

Match the assessment shell, which already gets this right, including the safe-area insets:

```css
padding-left:  max(1.25rem, env(safe-area-inset-left));
padding-right: max(1.25rem, env(safe-area-inset-right));
/* ≥640px */
padding-left:  max(2rem, env(safe-area-inset-left));
padding-right: max(2rem, env(safe-area-inset-right));
/* ≥1024px */
padding-left: 3rem; padding-right: 3rem;
```

### Vertical rhythm

| Context | <640px | ≥640px | ≥1024px |
|---|---|---|---|
| Section top/bottom padding | `4rem` | `5rem` | `7rem` |
| Heading → its first paragraph | `1rem` | `1rem` | `1.5rem` |
| Paragraph → paragraph | `1rem` | `1rem` | `1.5rem` |
| Section heading → section body | `2rem` | `2rem` | `3rem` |
| Between cards in a stack/grid | `1.5rem` | `1.5rem` | `2rem` |
| Above a section hairline rule | `3rem` | `4rem` | `6rem` |

Whitespace is the product here. If a reviewer's instinct is "this feels too spaced out", it is
correct. Leave it.

### Container widths

| Name | Max width | Use |
|---|---|---|
| `prose` | `34rem` / `38rem` ≥1024px | Any running text: insights, privacy, case study body |
| `content` | `68rem` | Default page container |
| `wide` | `80rem` | Pricing table, pipeline diagram, nav and footer only |

Containers are centred; their *contents* are left-aligned.

### Breakpoints

Tailwind defaults, unchanged: `sm 640` · `md 768` · `lg 1024` · `xl 1280`. Design and review at
**390px, 768px and 1280px**. `md` is used only where a two-column layout genuinely needs a stop
between tablet portrait and laptop; prefer `sm` → `lg`.

### Grid

- **<640px:** single column. Everything stacks. No horizontal scroll anywhere, ever — the
  pipeline and pricing get the mobile treatments specified in section 7 and the pricing note
  below, not an overflow scroller.
- **640–1023px:** two columns, `2rem` gap. Cards go 2-up; the five build types go 2-up with the
  fifth full width.
- **≥1024px:** 12-column grid, `2rem` gutter, inside `content`. Editorial split: body content
  occupies columns 1–8, and columns 9–12 are a **marginal rail** for the eyebrow label, the
  step number, the figure caption or the "what you get" list. The rail is what makes this read
  as editorial rather than as a landing page. The rail collapses to a preceding `label` line
  below 1024px.

Vertical alignment on the 12-column grid is to the **baseline of the first line**, not to the
box. Headings in a row line up on their cap height.

---

## 6. Component inventory

Every file in `src/components/` is accounted for. "Restyle" means the markup and logic survive
and only classes and tokens change. "Rewrite" means the component's job survives but the
implementation does not. "Delete" means `git rm`.

### Keep and restyle

| File | What changes |
|---|---|
| `dma/SelfServeAssessment.tsx` (1126) | Token swap only: raise all `text-[9px]/[10px]/[11px]` to `0.75rem`, replace `text-white/NN` with `--color-text-muted` / `--color-text-faint`, replace `border-white/NN` with `--color-rule` or `--color-border-interactive`, replace `bg-black/30|40|50` with `--color-surface-1`. No structural change. No logic change. |
| `dma/FullDma.tsx` (836), `dma/FullDmaQuestion.tsx`, `dma/DimensionBars.tsx`, `dma/ScoreDial.tsx`, `dma/full/*` | Same token swap. `ScoreDial` and `DimensionBars` keep their gold — they are the one diagram on that page. |
| `src/pages/assessment/index.astro` `<style is:global>` | Keep the whole block. It is already the design this contract describes: hairlines, one accent, 48px targets, a real print stylesheet, `prefers-reduced-motion` honoured. Replace the hard-coded hexes with `var(--color-*)` and lift the `.dma-button-primary` / `.dma-button-quiet` / focus rules out into `global.css` as the sitewide button and focus styles. **The assessment's CSS becomes the site's CSS, not the other way round.** |
| `SEOHead.astro` | Keep. Update the default description and the OG image reference. |
| `CookiesBanner.tsx` | Keep the logic, restyle to a bottom hairline-bordered bar on `--color-surface-1`, no blur, no rounded pill. |
| `BlogCard.tsx` | Restyle for Insights and Case studies: no image, no card border — a hairline above, `label` eyebrow (date · read time), `h3` title, two-line `small` excerpt. |
| `InsightsFilter.tsx` (372) | Keep the filtering logic. Restyle the controls to text-button tabs with a gold underline on the active tab. Strip any animation beyond the 150ms colour transition. |
| `MobileMenu.tsx` (251) | Keep as the nav. Rewrite the panel to a full-screen opaque `--color-obsidian-void` sheet with 56px-tall link rows and a 44px close target. No blur, no slide-and-fade stack. Nav shrinks to six items (section 10). |
| `ContactForm.tsx` (621) | **Promote.** It is currently unused but it is the real Turnstile + webhook form (`PUBLIC_CONTACT_WEBHOOK_URL`, `PUBLIC_TURNSTILE_SITE_KEY`). It becomes the `/contact` page form, restyled to the assessment's field styles (`.dma-field` focus ring, 48px controls). Keep Turnstile. |
| `AccordionSection.tsx` (136) | Keep for the Pricing FAQ only. Restyle to hairline rows with a `+`/`−` glyph, no card, no chevron rotation beyond 150ms. |

### Rewrite

| File | Becomes |
|---|---|
| `PageHero.tsx` (76) | `PageHeader.tsx` — a left-aligned block: `label` eyebrow, `h1`, one `lede` paragraph, a hairline underneath. No background, no image, no centring. Used on every page except Home. |
| `GoldButton.tsx` (33) | `Button.tsx` — drops `framer-motion` and `whileTap`, drops `hover:scale-105`, drops the `ring` focus in favour of the assessment's `outline: 2px solid gold; outline-offset: 3px`. Variants: `primary` (gold fill, obsidian text), `secondary` (`--color-border-interactive` border, vapor-white text), `quiet` (underlined text link, the existing `.dma-button-quiet`). Min height 48px. It is imported in 18 places, so keep the export name aliased for one commit, then rename the call sites. |
| `OnboardingSteps.tsx` (148) | `PipelineSteps.tsx` — the seven-step pipeline list on `/how-it-works`, built to the diagram spec in section 7. The existing stepper markup is a reasonable starting point; the partner-network content it carries is deleted. |

### Delete

**Venture studio, impact and partner network — the whole story Joash is cutting:**

```
src/pages/venture-studio/index.astro
src/pages/venture-studio/incubation-and-funding.astro
src/pages/venture-studio/compliance-and-registration.astro
src/pages/impact.astro
src/pages/partner-network.astro
src/content/pages/venture-studio.md
src/content/pages/incubation-and-funding.md
src/content/pages/compliance-and-registration.md
src/content/pages/impact.md
src/content/pages/partner-network.md
src/content/terminal_forms/venture-application.json
src/content/terminal_forms/idc-partner.json
src/components/ProjectCard.tsx          (portfolio cards)
src/components/StatsCounter.tsx         (animated impact numbers)
src/assets/impact.jpg
src/assets/catalyst.jpg
```

**The old consulting tree, replaced by `/what-we-build`:**

```
src/pages/consulting/index.astro
src/pages/consulting/digital-transformation.astro
src/pages/consulting/operations-excellence.astro
src/pages/consulting/tech-implementation.astro
src/content/pages/consulting-overview.md
src/content/pages/digital-transformation.md
src/content/pages/operations-excellence.md
src/content/pages/tech-implementation.md
src/components/ServiceCard.tsx
src/assets/consulting.jpg
```

**The art-direction offenders:**

```
src/components/CanvasHero.tsx           (276) animated particle canvas, used in 12 places
src/components/NetworkCube.tsx          (121) rotating 3D network
src/components/BranchingTree.tsx        (146) decorative tree
src/components/TenXCoreProcessor.tsx    (197) "core processor" chip graphic
src/components/AfricaMap.tsx            (61)  Africa silhouette
src/components/GlassCard.tsx            (30)  glassmorphism
src/components/BentoGrid.tsx            (127) bento layout
src/components/SystemStatusPill.tsx     (73)  fake live-status pill
src/components/GetStartedModal.tsx      (172) interstitial modal
src/components/GetStartedModalController.tsx (39)
src/components/TerminalFormChat.tsx     (951) terminal chat form engine
src/components/DigitalConsultingChat.tsx (598) unused chat form
src/components/ComingSoon.tsx           (198)
src/components/TeamMember.tsx           (108)
src/assets/circuit-tree.svg
src/assets/OutlineMap-Africa.svg
src/layouts/TerminalLayout.astro
src/pages/forms/[slug].astro
src/pages/coming-soon.astro
src/content/pages/coming-soon.md
src/content/terminal_forms/            (whole collection + its entry in src/content/config.ts)
src/content/team/                      (whole collection + its entry in src/content/config.ts)
```

Deleting `CanvasHero` touches `MainLayout.astro`, `index.astro`, `404.astro` and every page
being deleted anyway — remove the import and the `<CanvasHero>` element, including the footer
mesh. Deleting `TerminalFormChat` removes the contact route, which is why `ContactForm.tsx` is
promoted in the same commit; the two must land together or `/contact` breaks.

**Also strip from `MainLayout.astro`:** the `hello@tenxafrica.co.za` contact point (use
`joash@tenxafrica.co.za`), the Twitter `sameAs` entry and the Twitter footer icon (we do not run
social), the "Strategy. Technology. Capital. Impact." strapline in the footer and in the default
`description` prop, the `/coming-soon` "Login" button, and the JSON-LD `description`. Footer
gains the full postal address from `CLAUDE.md` (Ten X Africa (Pty) Ltd, 9 Roosevelt Street,
Robindale Ext 1, Randburg, Johannesburg, 2194, South Africa), the registration and VAT numbers,
and a link to `/privacy#opt-out` — every cold email points at that anchor, so it must exist.

**One item to confirm with Joash before deleting:** `src/content/team/Ashley-Paul.json`. The
business description says Joash is the only human, so the team collection goes and the founder
becomes a single paragraph plus one photograph on `/how-it-works`. Confirm before the commit.

---

## 7. Showing the pipeline and the builds without stock imagery

Every graphic on this site is one of exactly three kinds. Nothing else is allowed.

**Kind A — hand-specified SVG line diagrams.** Inline `<svg>` in the Astro page or a small
`.astro` component, never an `<img>`, so they inherit `currentColor` and stay crisp. Rules:
stroke `1.5px`; strokes `--color-text-faint` (`#7B848E`); labels in Inter 400 at `0.8125rem` in
`--color-text-muted`; exactly one element per diagram stroked or filled `--color-tenx-gold`;
fills `--color-surface-1` or none; no gradients, no shadows, no rounded-corner "app window"
chrome, no icons inside nodes. Every diagram carries `role="img"` and a `<title>` that states
what it shows, plus a visible `caption` line beneath it.

**Kind B — real screenshots on a paper plate.** A genuine screenshot of a running system, placed
on a `--color-paper` plate with `1.5rem` padding, `2px` radius, a `--color-rule` border, and a
`caption` beneath naming what it is and what it replaced. Served as AVIF with a WebP fallback,
`loading="lazy"`, `decoding="async"`, explicit `width`/`height`, and real alt text describing the
screen. No browser chrome, no laptop mockup, no perspective, no device frame, no glow.

**Kind C — the logo.** `src/assets/Logo.png` in the nav and footer at 40px. Nowhere else, at no
other size, never as a watermark or background.

### The screenshot problem, answered

We have one shipped product surface today: the assessment. So:

- **Launch set (build now):** the two screenshots that exist honestly — the assessment question
  step and the assessment result with `ScoreDial` and `DimensionBars` — captured at 390px wide
  for mobile and 1280px for desktop, into `src/assets/shots/`. They appear on Home and on
  `/assessment`'s intro.
- **Everything else is Kind A until a real build ships.** Do not mock up a fake dashboard and
  present it as a client system. Draw the diagram instead.
- **When a client build goes live,** its screenshot replaces the diagram for that build type,
  with written permission, data anonymised at the source (never blurred in post — blur reads as
  something to hide), and the client named in the caption if they agree.

### The seven-step pipeline — `/how-it-works`

**Desktop (≥1024px), Kind A, one diagram, `wide` container, ~1120×220.** A single horizontal
spine: a 1.5px `--color-text-faint` line across the full width with seven nodes on it. Each node
is a 40px circle, `--color-surface-1` fill, `--color-rule` stroke, holding the step number in
Outfit 600 `0.9375rem`. Above each node, the step name in `label` casing. Below each node, the
owner in `caption`: either `You` or `Us`. Steps 3 and 6 — the DMA call and the walkthrough call —
are the only nodes stroked and numbered in gold, because those are the two moments a human is in
the room, and that is the single most important fact on the page. Between steps 4 and 5 the spine
carries a small `caption` label reading `first draft — no meeting needed`.

The seven steps, in order, with owner:

| # | Step | Owner | Caption line |
|---|---|---|---|
| 1 | We find you, or you find us | Us | Research, referral or the score on this site |
| 2 | You take the 3-minute score | You | Twelve questions, no login |
| 3 | **The 45-minute assessment call** | Both | Joash and you, on Teams |
| 4 | The assessment becomes the spec | Us | Fixed price, fixed scope, in writing |
| 5 | We build the first working draft | Us | Days, not months — you do nothing |
| 6 | **The walkthrough call** | Both | You use it, we write down what is wrong |
| 7 | Changes, deploy, then we run it | Us | Monthly retainer, you own the system |

**Mobile (<1024px):** the spine rotates to vertical and becomes a list, not a scroller. Each step
is a row: a 32px numbered circle in a left column with a 1.5px connector running through it to
the next row, and the name, owner and caption in the right column. Steps 3 and 6 keep the gold
circle. This is `PipelineSteps.tsx`. **There is no horizontal scroll and no carousel.**

**On Home,** the pipeline appears as a condensed three-node version — *assessment call · first
draft · we run it* — with a `quiet` link to `/how-it-works`.

### The five build types — `/what-we-build`

One page. Five sections, each with the same five parts in the same order, so the page reads as a
catalogue: `label` eyebrow (`Build type 01`) · `h2` name · one `lede` sentence in plain English ·
a Kind A schematic · a `small` "What it replaces" line and a `small` "Typical band" line linking
to `/pricing`. Each schematic is ~640×320 on desktop, redrawn to ~340×400 portrait on mobile
(a separate `<svg>` swapped at `lg`, not a scaled-down one — a wide diagram shrunk to 340px is
unreadable).

| # | Build | Diagram to draw | What it depicts |
|---|---|---|---|
| 01 | Intake and onboarding portal | **Two-lane before/after.** Top lane, `--color-text-faint`: five boxes — enquiry email, PDF form, phone call, spreadsheet row, chase-up email — connected by a wandering line with three doubling-back arrows. Bottom lane, one gold-stroked box — a form — feeding a single straight line into a record. Caption: "Six places a new client's details get typed, down to one." | That intake is re-keying, and the build removes the re-keying. |
| 02 | Quote to invoice | **A five-stage ladder with a clock on each rung.** Stages: quote built · quote sent · accepted · invoice raised · paid. Each rung carries a `caption` with a before time and an after time (for example `40 min → 4 min`). The "accepted" rung is gold, because that is the trigger everything downstream hangs off. | Where the hours go, and which single event the automation hooks. |
| 03 | Operations dashboard | **A wireframe of the real layout**, drawn as rules and empty rectangles — no fake bar charts, no lorem numbers. Top row: four tiles labelled `Jobs open`, `Overdue`, `Invoiced this month`, `Awaiting you`. Below: a table wireframe with six labelled rows and a gold marker against the one row flagged as needing attention. | That the dashboard answers four questions, not that it looks pretty. |
| 04 | Document generation | **A fan.** One gold-stroked source record on the left; three lines fanning right to three outlined document shapes labelled `Proposal`, `Contract`, `Report`, each with three horizontal rule-lines standing in for text. A dashed return arrow from the documents back to the record, labelled `signed, filed, logged`. | One set of facts, many documents, and the loop back to the record. |
| 05 | Inbox triage and routing | **A sorting fork.** A single inbound stack on the left splits into four labelled lanes: `Answer now`, `Needs a quote`, `Route to <person>`, `No action`. Lane volumes are shown as line weight, not as a chart. The `Needs a quote` lane is gold and connects across to the Build 02 diagram's first stage — the only cross-reference on the page, and it earns its place because that is the actual handover. | That triage is a decision tree, and that the builds connect. |

**Case studies** use the same anatomy: `label` (sector · country · build type) · `h1` · a
one-sentence outcome in `lede` · a "Before / After / Time back" three-row hairline table · a Kind
B screenshot when permitted, otherwise the matching Kind A diagram · and one pull-quote set in
`h3` with a gold left rule. Until a real case study exists, `/case-studies` shows one honest
paragraph explaining that the first builds are in progress and links to `/assessment`. **No
placeholder case studies, no invented logos, no "Client A".**

### Pricing on mobile

Three plans stack vertically: Launch, **Growth**, Scale. Growth is marked with a gold `label`
reading `Most clients start here`, a gold 2px left rule, and `--color-surface-1` fill. It is not
larger, not scaled, not lifted. Each plan is a hairline block: name · `from $X,XXX` in `h2` ·
`+ $XXX per month` in `small` · a "Good fit when" list of three `small` lines · one `secondary`
button reading `Book the assessment`. Below all three, a `caption` block stating the terms
verbatim: 12-month minimum on retainers, tool costs passed through, 50% deposit and 50% on
acceptance, and that the assessment call produces one fixed price inside the matching band.
At ≥1024px the three become a three-column comparison sharing one row of hairlines.

---

## 8. Accessibility floor

Target: **Lighthouse accessibility ≥ 95 on mobile** for every page in the route map, and zero
critical or serious findings from axe-core. The brief says above 90; we build to 95 so a late
change does not drop us under.

**Contrast.** Every text token in section 3 is listed with its measured ratio and all clear
4.5:1 against `--color-obsidian-void`. Rules: no text below 4.5:1 regardless of size, because
we do not rely on the large-text exemption; no text on the gold fill other than
`--color-obsidian-void`; no opacity-based text colours — `text-white/40` and `text-white/35`
appear 25 times in the assessment today and land near 4:1, so every one is replaced by a solid
token; non-text boundaries that carry meaning (control borders, focus rings, the gold diagram
element, chart strokes) meet 3:1, which is why `--color-border-interactive` is `#57616B` at
3.05:1 and not the `#1E262E` hairline.

**Focus.** Exactly one visible style sitewide, lifted from the assessment:
`outline: 2px solid var(--color-tenx-gold); outline-offset: 3px`. Never `outline: none` without
a replacement. Answer cards and any control where gold already means "selected" get the
vapor-white ring at `2px` offset instead — the assessment already handles this and the reasoning
is sound. Focus order follows the DOM. The skip link (`Skip to content`, first focusable element,
visible on focus, jumps to `#main`) is added to `MainLayout.astro`; it does not exist today. The
80px fixed nav means every in-page anchor target needs `scroll-margin-top: 6rem` or focused
content hides behind the header.

**Targets.** 48×48px minimum for primary actions, 44×44px absolute minimum for anything tappable,
with at least 8px between adjacent targets. Nav rows on mobile are 56px tall. The existing
`.dma-button-primary` (48px) and `.dma-button-quiet` (44px) already comply. Inline text links
inside prose are exempt, as the standard allows.

**Motion.** Keep and extend the assessment's `prefers-reduced-motion` block to `global.css`,
scoped to the whole document rather than `.dma-shell`. Under reduced motion every transition and
animation drops to `0.01ms` and `scroll-behavior` becomes `auto` — which means removing
`class="scroll-smooth"` from `<html>` in `MainLayout.astro` or overriding it in the media query.
Nothing auto-plays, nothing loops, nothing flashes.

**Structure.** One `<h1>` per page, no skipped heading levels. `<main id="main">` wraps the slot.
Landmarks: `header > nav`, `main`, `footer`. Every diagram gets `role="img"` + `<title>` +
`aria-labelledby`; purely decorative rules get `aria-hidden="true"`. Icon-only buttons carry
`aria-label`. Form fields have real `<label>` elements, not placeholders as labels; errors use
`aria-describedby` and `aria-invalid` and are announced in a `role="status"` region — the
assessment already does this and it is the pattern for `ContactForm` too. `<html lang="en">`
stays. Link text stands alone: never "click here", never "read more" without the title in an
`sr-only` span.

**Zoom and reflow.** No horizontal scroll at 320px width, and no loss of content or function at
400% zoom. The pricing table and pipeline diagram are the two risks; both have specified mobile
treatments above. Text must survive `text-size-adjust` at 200% without clipping, which is why
nothing is set below 12px and why fixed heights are banned on anything containing text.

**Screen-reader pass.** Before merge, walk Home, `/how-it-works`, `/what-we-build`, `/pricing`
and `/assessment` with VoiceOver on iOS in rotor-by-heading mode. If the heading list alone does
not tell you what the page says, the page is wrong.

---

## 9. Finish gate

A reviewer runs this list against a built preview on a real phone, not a resized desktop window.
**Any single `NO` rejects the work.** State the number that failed.

1. **The venture story is gone.** `grep -ri "venture\|incubat\|impact invest\|portfolio\|funding\|partner network\|backing the bold" src/` returns nothing outside `docs/`. No orphan routes, no dead nav items, no dangling sitemap `customPages` entries in `astro.config.mjs`.
2. **No banned visual.** No canvas, no `backdrop-blur`, no gradient background, no stock photograph of a person, no Africa silhouette, no rotating anything. `grep -r "backdrop-blur\|CanvasHero\|glass-panel\|bg-gradient" src/` returns nothing.
3. **One accent, used sparingly.** On any single viewport screenshot, count the gold elements. More than five is a rejection. Gold never appears as body text, and never on more than one heading per page.
4. **Palette discipline.** No hex literal in any component file that is not a `var(--color-*)` reference; the only exceptions are the diagram SVGs and the print block, which must use the named tokens too. `--color-slate-teal`, `red: '#FF0000'` and `glass-gradient` are gone from `tailwind.config.mjs`.
5. **Type floor.** `grep -rE "text-\[(9|10|11)px\]|text-\[0\.6[0-9]*rem\]" src/` returns nothing. No body text below `0.75rem`. No paragraph wider than `38rem`.
6. **Mobile first, proven.** At 390×844 every page renders with no horizontal scroll, no element clipped, no text under 12px, no carousel, and every tap target at least 44px. Check at 320px too. If a layout only makes sense at 1280px, it fails.
7. **The assessment still works and now matches.** `/assessment` submits end to end, the result renders, `Ctrl+P` still produces the ink-on-paper sheet, and the page visually belongs to the same site as Home. If any of `SelfServeAssessment.tsx`, `FullDma.tsx` or `shared/dma/*` changed by more than class strings, it was rebuilt instead of restyled — reject.
8. **Every diagram is ours.** Each graphic is inline SVG drawn to the section 7 spec, or a genuine screenshot of a real running system on a paper plate with a caption. No purchased illustration, no icon-pack montage, no mocked-up dashboard presented as a client's. Each carries `role="img"`, a `<title>`, and a visible caption.
9. **The pipeline reads as seven steps with two human moments.** Steps 3 and 6 are gold on both the mobile and desktop rendering and are the only gold nodes. The owner (`You` / `Us`) is legible on every step at 390px.
10. **The five builds are parallel.** All five sections carry the same five parts in the same order, and each says in plain English what it replaces. No build type is missing its diagram.
11. **One call to action.** Every page ends on the assessment. No newsletter box, no "Get Started" modal, no live-chat bubble, no third competing button. The Bookings URL is exactly `https://bookings.cloud.microsoft/book/DiscoveryCall@tenxafrica.co.za/`.
12. **Pricing is correct and hedged properly.** Launch $2,500–4,500 + $249/mo, Growth $6,500–12,000 + $649/mo, Scale $15,000–28,000 + $1,450/mo, all as "from", USD stated, Growth marked as the typical choice, and the terms line present (12-month retainer minimum, tool costs passed through, 50/50).
13. **Copy passes the plain-English test.** Read any page aloud. Zero words from the banned list in section 2. "AI" appears at most twice per page and never in an H1. Every claim is a thing we do or a number, not an adjective.
14. **Accessibility.** Lighthouse mobile accessibility ≥ 95 and axe-core clean on Home, `/how-it-works`, `/what-we-build`, `/pricing`, `/assessment`, `/contact`, `/privacy`. Keyboard-only: skip link works, focus is visible on every control, nothing is reachable only by mouse, the mobile menu traps and restores focus.
15. **Compliance furniture exists.** Footer carries the full registered address, Reg 2020/714539/07 and VAT 4250317601. `/privacy` has a reachable `#opt-out` anchor with a working opt-out route, because every cold email links to it. No Twitter or social link anywhere on the site.
16. **Performance.** Lighthouse mobile performance ≥ 90 and CLS < 0.1. No render-blocking font, images sized and lazy below the fold, and the build ships no JavaScript for a page that has no interactive component — Home, `/how-it-works`, `/what-we-build` and `/pricing` should be zero-JS or close to it.
17. **It could not be any other company's site.** Cover the logo and the name. If the page would work unchanged for a generic agency, it fails — the diagrams, the seven steps, the named build types and the two human moments are what make it ours.

---

## 10. Route map and navigation

| Route | Page | Source |
|---|---|---|
| `/` | Home | new `src/pages/index.astro` |
| `/how-it-works` | The 7-step pipeline | new |
| `/what-we-build` | The five build types | new |
| `/pricing` | Three plans + FAQ | new |
| `/assessment` | Digital Maturity Score | **exists — restyle only** |
| `/book` | Book a call | new; intro paragraph + the Bookings embed or link |
| `/insights` , `/insights/[slug]` | Insights | keep, restyle |
| `/case-studies` , `/case-studies/[slug]` | Case studies | new collection |
| `/contact` | Contact | new page wrapping the promoted `ContactForm.tsx` |
| `/privacy` (with `#opt-out`) | Privacy and opt-out | keep, rewrite content |
| `/terms` | Terms | keep, restyle |
| `/404` | Not found | keep, strip `CanvasHero` |
| `/internal/dma` | Joash's full DMA tool | keep as is, stays `noindex` |

Primary nav, six items: **How it works · What we build · Pricing · Insights · Case studies ·
Contact**, plus one gold `Take the free assessment` button. No dropdowns — the current nav has
hover submenus that do not exist on a phone.

Old URLs (`/consulting/*`, `/venture-studio/*`, `/impact`, `/partner-network`, `/forms/*`,
`/coming-soon`) get entries in `astro.config.mjs` `redirects`, which on a static GitHub Pages
build emit meta-refresh pages with canonicals — the only redirect mechanism available to us.
`/consulting/*` → `/what-we-build`; everything else → `/`. Remove the dead `customPages` entries
from the sitemap config in the same commit.
