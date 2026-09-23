# Rebuild inventory: what has to go, and what it is wired into

Working notes for the `rebuild-2026-09` branch, written 23 September 2026.

The brief says to strip **all** Venture Studio, incubation, funding and impact-investment
content. That story is not confined to a few pages: a scan of `src/` found 106 references
across 22 files, including the home page, the navigation, the footer, the legal pages and
several React components. Doing this in pieces leaves the site linking to pages that no
longer exist, so it is treated here as one change, done in the order below.

This file is the map, not the work. Sections 1 and 2 have since been done; see section 7
(Status) for what is finished and what is still open before using the list as a work queue.

## 1. Routes to delete

| File | Route |
| --- | --- |
| `src/pages/venture-studio/index.astro` | `/venture-studio` |
| `src/pages/venture-studio/compliance-and-registration.astro` | `/venture-studio/compliance-and-registration` |
| `src/pages/venture-studio/incubation-and-funding.astro` | `/venture-studio/incubation-and-funding` |
| `src/pages/impact.astro` | `/impact` |
| `src/pages/partner-network.astro` | `/partner-network` |

`/partner-network` goes because the Independent Consultant network belongs to the old
operating model: there is one human in the business now.

## 2. Content files to delete

- `src/content/pages/venture-studio.md`
- `src/content/pages/incubation-and-funding.md`
- `src/content/pages/compliance-and-registration.md`
- `src/content/pages/impact.md`
- `src/content/pages/partner-network.md`
- `src/content/terminal_forms/venture-application.json`
- `src/content/terminal_forms/idc-partner.json`

Deleting a terminal form also removes its route, because `src/pages/forms/[slug].astro`
generates one page per file in that collection.

## 3. Files that reference the old story and must be edited, not deleted

| File | What is in it |
| --- | --- |
| `src/content/settings/site-config.md` | Navigation has `VENTURE STUDIO` with two children, `PARTNER NETWORK` and `IMPACT`. Footer column `ECOSYSTEM` links to Ventures and Impact Funding; `FIRM` links Our Philosophy to `/impact` and Join Network to `/partner-network`; `quickLinks` links Join Network to `/partner-network`. Every one of these is a dead link once section 1 is done. |
| `src/content/pages/index.md` | Home page content still carries the ecosystem and ventures framing. |
| `src/content/pages/terms.md` | References the venture and incubation services. |
| `src/content/pages/privacy.md` | Same, and this page also needs the opt-out and postal-address wording the brief asks for. |
| `src/content/insights/saas-trap-smmes-building-assets.md` | An existing article mentions venture building in its body. Keep the article, reword the mentions. |
| `src/components/BentoGrid.tsx` | Home page grid built around the three-part ecosystem. |
| `src/components/OnboardingSteps.tsx` | The heaviest single component, built around the old onboarding. Likely replaced outright by the seven-step pipeline. |
| `src/components/GetStartedModal.tsx` | Routes visitors into consulting, ventures or funding. The only route now is the assessment. |
| `src/components/DigitalConsultingChat.tsx` | Mentions the old service split. |
| `src/components/BranchingTree.tsx` | One reference; check whether the component survives the redesign at all. |
| `src/content/config.ts` | Still defines `ventures`, `consultants` and `impact_stories` collections. They are already unused: none of them is exported in `collections`. Remove the dead definitions while here. |

## 4. Schema fields that become dead

`src/content/config.ts` `pages` schema carries optional fields that exist only for the pages
being deleted: `portfolio`, `forStartups`, `forInvestors`, `fundingModel`, `esg`,
`programs`, `networkRoles`, `idealCandidate`, `foundations`, `catalyst`, `bridge`,
`ecosystem`, `idcNetwork`, `hybridModel`, `footprint`. Remove them once the pages are gone,
or the schema keeps documenting a business that no longer exists.

## 5. Order of work

1. Edit `site-config.md` first: take the dead entries out of the navigation, the footer and
   the quick links. Doing this first means the site never renders a link to a page that has
   already been deleted.
2. Delete the routes in section 1 and the content files in section 2.
3. Rewrite the home page content and the components in section 3.
4. Clean up `config.ts`: drop the unused collections and the dead schema fields.
5. Rewrite `terms.md` and `privacy.md`, adding the opt-out wording and the postal address.
6. Add redirects for the deleted routes so old links and anything still indexed by search
   engines land somewhere sensible rather than on a 404.
7. Run the build, then check every internal link.

## 6. Three decisions for Joash, not for the build

- The footer links to a LinkedIn page and a Twitter account. The business rule is no social
  media presence. Leave them or remove them, but it is his call.
- The public contact address on the site is `hello@tenxafrica.co.za`. The company details
  used everywhere else say `joash@tenxafrica.co.za`. The footer is being rebuilt anyway, so
  settle which one the site shows.
- The `team` collection still holds two people, `Joash-Paul.json` and `Ashley-Paul.json`.
  The design contract proposes dropping the collection on the grounds that there is one
  person in the business. That is a judgement about how the business is presented, not a
  build decision, so nothing has been deleted. Say whether the team section goes, stays with
  one person, or stays with both.

## 7. Status

Sections 1 and 2 are **done** as of 23 September 2026: the five routes, five content files
and two terminal forms are deleted, and the navigation, footer and quick links no longer
point at them. A clean build produces 17 pages, down from 24.

Sections 3, 4 and 5 are **not started**. The home page content, the components and the legal
pages still carry the old framing, and the dead schema fields are still in `config.ts`.
Those are rewritten against `docs/design-contract.md` rather than patched.
