# Ten X Africa

**The Hybrid Engine for African Innovation.**

This repository contains the source code for the official website of **Ten X Africa** ([tenxafrica.co.za](https://tenxafrica.co.za)). Ten X Africa is a hybrid firm operating at the intersection of Technology Consulting, Venture Building, and Impact Investment.

![Tech Stack](https://img.shields.io/badge/Built%20With-Astro-orange?style=flat-square) ![Runtime](https://img.shields.io/badge/Runtime-Bun-black?style=flat-square) ![Status](https://img.shields.io/badge/Status-Live-success?style=flat-square)

## 🛠 Tech Stack

This website is a static site generated using modern web performance tools:

-   **Framework:** [Astro.js](https://astro.build/) (Static Site Generator)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components:** React
-   **Language:** TypeScript
-   **Runtime:** [Bun](https://bun.sh/)
-   **Deployment:** GitHub Pages (via GitHub Actions)

## 🚀 Getting Started

If you want to run this project locally to test changes or view the code structure:

### Prerequisites
-   [Bun](https://bun.sh/) (v1.0 or higher)

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/TenXAfrica/website](https://github.com/TenXAfrica/website)
    cd tenx-website
    ```

2.  **Install dependencies**
    ```bash
    bun install
    ```

3.  **Run the development server**
    ```bash
    bun run dev
    ```

4.  **Open your browser**
    Navigate to `http://localhost:4321` to see the site running locally.

## 📂 Project Structure

```text
/
├── public/           # Static assets (images, fonts, robots.txt)
├── src/
│   ├── components/   # Reusable UI components (React/Astro)
│   ├── layouts/      # Page wrappers (Headers, Footers, SEO)
│   ├── pages/        # Route definitions (index.astro, etc.)
│   └── styles/       # Global CSS and Tailwind directives
├── astro.config.mjs  # Astro configuration
└── tailwind.config.mjs # Tailwind configuration
```

## ✍️ Publishing content

Insights posts and case studies are plain markdown files in the repository. There is no CMS
and no admin login: commit a file to `main` and the GitHub Actions build publishes it. This is
what lets the content routine add a post on its own.

A file is live once the build that follows the push finishes, usually a couple of minutes.
Set `draft: true` to keep a file in the repository but out of the built site.

### Publishing an insights post

Add one file at `src/content/insights/<url-slug>.md`. The slug becomes the URL:
`src/content/insights/how-we-price.md` publishes at `/insights/how-we-price`.

```yaml
---
title: "How we price an automation build"          # required
excerpt: "A short summary, used on cards and in search results."   # required
publishedAt: 2026-09-23                            # required, YYYY-MM-DD
author:                                            # required
  id: joash-paul
  name: Joash Paul
  role: Founder
image:                                             # required
  src: /assets/insights/how-we-price.png
  alt: "Describe the image for someone who cannot see it."
tags: ["pricing", "automation"]                    # required, may be empty: []
readTime: 6                                        # required, whole minutes
---

The body of the post goes here as ordinary markdown.
```

### Publishing a case study

Add one file at `src/content/case_studies/<url-slug>.md`.

```yaml
---
title: "Cutting quote turnaround from three days to twenty minutes"   # required
client: "A 30-person plumbing contractor"          # required, see note below
sector: "Trades and field services"                # required
country: "Ireland"                                 # required
excerpt: "A short summary, used on cards and in search results."      # required
publishedAt: 2026-09-23                            # required, YYYY-MM-DD
buildType: quote-to-invoice                        # required, one of the five below
image:                                             # required
  src: /assets/case-studies/quote-turnaround.png
  alt: "Describe the image for someone who cannot see it."
results:                                           # optional, defaults to []
  - value: "20 min"
    label: "Average quote turnaround"
  - value: "11 hrs/week"
    label: "Admin time given back"
tags: ["quoting", "invoicing"]                     # optional, defaults to []
readTime: 4                                        # optional
draft: false                                       # optional, defaults to false
---

The body of the case study goes here as ordinary markdown.
```

`buildType` must be exactly one of:
`intake-and-onboarding-portal`, `quote-to-invoice`, `operations-dashboard`,
`document-generation`, `inbox-triage-and-routing`.

There is a ready-made template at `src/content/case_studies/_example.md`. Copy it rather
than writing the frontmatter by hand. Its name starts with an underscore, which is how
Astro is told to ignore it, so the template itself is never published.

**Expected build warning.** Until the first real case study is added, every build prints
`[WARN] [glob-loader] No files found matching ... in directory src\content\case_studies`.
That is correct: the collection exists and holds only the ignored template. The warning
disappears on its own when the first study lands. Nothing needs fixing.

**Naming a client.** Only use a client's real name when they have agreed in writing.
Otherwise describe them, as in the example above. The build fails loudly on a missing or
misspelled field, so a bad file never reaches the live site silently.

## 🐞 Bugs & Issues

If you notice a bug on the website, a broken link, or a display issue, please let us know directly.

**Email:** [joash@tenxafrica.co.za](mailto:joash@tenxafrica.co.za)

## 🤝 Contributing & Careers

Ten X Africa operates on a model of Independent Consultants (IDCs) and strategic partners.

-   **Found a bug?** Please email us before opening an issue.
-   **Want to join the network?** We are always looking for elite developers, consultants, and venture builders.
-   **Open Source?** While this repository is public for transparency, direct pull requests are restricted to authorized team members.

To inquire about joining the team or contributing to our ecosystem, please contact **Joash** at [joash@tenxafrica.co.za](mailto:joash@tenxafrica.co.za).
---

© 2026 Ten X Africa. All Rights Reserved.