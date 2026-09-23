---
title: "Cutting quote turnaround from three days to twenty minutes"
client: "A 30-person plumbing contractor"
sector: "Trades and field services"
country: "Ireland"
excerpt: "Quotes went out the same morning instead of three days later, and the owner got eleven hours a week back."
publishedAt: 2026-01-01
buildType: quote-to-invoice
image:
  src: /assets/case-studies/example.png
  alt: "Describe the image here for someone who cannot see it."
results:
  - value: "20 min"
    label: "Average quote turnaround"
  - value: "11 hrs/week"
    label: "Admin time given back"
tags: ["quoting", "invoicing"]
readTime: 4
before: "Quotes typed up in Word from site notes, sent up to three days later"
after: "Quote built from the site visit form and sent the same morning"
timeBack: "11 hours a week of the owner's admin"
quote:
  text: "We stopped losing jobs to whoever quoted first."
  attribution: "Owner, plumbing contractor"
draft: false
---

This file is a template, not a published case study.

Its name starts with an underscore, which is how Astro is told to ignore it, so it never
reaches the live site and never appears in any listing. Copy it to a new file named after
the URL you want — `src/content/case_studies/quote-turnaround.md` publishes at
`/case-studies/quote-turnaround` — then replace every field above and this body text.

The fields are documented in full in the README, under "Publishing a case study". The two
that catch people out:

- `buildType` must be exactly one of `intake-and-onboarding-portal`, `quote-to-invoice`,
  `operations-dashboard`, `document-generation` or `inbox-triage-and-routing`. Anything else
  fails the build.
- `client` is only a real company name when that company has agreed in writing. Otherwise
  describe them, as above.

Write the body as ordinary markdown: what the business was doing before, what was built,
what changed, in plain words and with real numbers wherever there are any.
