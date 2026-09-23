import { defineCollection, z } from 'astro:content';

const insights = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        excerpt: z.string(),
        publishedAt: z.date(),
        author: z.object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
        }),
        image: z.object({
            src: z.string(),
            alt: z.string(),
        }),
        tags: z.array(z.string()),
        readTime: z.number(),
        // Set true to keep a post out of the built site while it is drafted.
        draft: z.boolean().default(false),
    }),
});

// Case studies. One markdown file per study, committed straight to the repo:
// the site rebuilds on push, so no CMS step is involved. The frontmatter is
// documented in README.md under "Publishing a case study".
const case_studies = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        // Use the client's real name only with written permission; otherwise
        // describe them, e.g. "A 30-person plumbing contractor".
        client: z.string(),
        sector: z.string(),
        country: z.string(),
        excerpt: z.string(),
        publishedAt: z.date(),
        // The five standard build types.
        buildType: z.enum([
            'intake-and-onboarding-portal',
            'quote-to-invoice',
            'operations-dashboard',
            'document-generation',
            'inbox-triage-and-routing',
        ]),
        image: z.object({
            src: z.string(),
            alt: z.string(),
        }),
        // Headline outcomes, shown as a row of figures at the top of the study.
        results: z.array(
            z.object({
                value: z.string(),
                label: z.string(),
            })
        ).default([]),
        tags: z.array(z.string()).default([]),
        readTime: z.number().optional(),
        // Optional "Before / After / Time back" table at the top of the study
        // (design contract section 7). One short line each, plain words.
        before: z.string().optional(),
        after: z.string().optional(),
        timeBack: z.string().optional(),
        // Optional pull quote from the client. Only with their written agreement.
        quote: z.object({
            text: z.string(),
            attribution: z.string().optional(),
        }).optional(),
        // Set true to keep a study out of the built site while it is drafted.
        draft: z.boolean().default(false),
    }),
});

// Global site settings: header nav (six items, no dropdowns), the one
// header button, and the footer. No social links — the business does not
// run social media.
const link = z.object({
    label: z.string(),
    href: z.string(),
});

const settings = defineCollection({
    type: 'content',
    schema: z.object({
        navigation: z.array(link),
        navCta: link,
        footer: z.object({
            links: z.array(link),
            legalLinks: z.array(link),
            company: z.object({
                name: z.string(),
                registration: z.string(),
                email: z.string().email(),
            }),
            copyright: z.string(),
        }),
    }),
});

// Page-specific content collections
const pages = defineCollection({
    type: 'content',
    schema: z.object({
        seo: z.object({
            title: z.string(),
            description: z.string(),
        }),
        hero: z.object({
            tag: z.string().optional(),
            headline: z.string(),
            subheadline: z.string(),
            highlightedText: z.string().optional(),
            primaryCta: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
            secondaryCta: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
        }),
        // Contact page fields
        form: z.object({
            interests: z.array(
                z.object({
                    value: z.enum(['consulting', 'network', 'catalyst', 'general']),
                    label: z.string(),
                    description: z.string().optional(),
                    subOptions: z.array(z.object({
                        value: z.string(),
                        label: z.string(),
                    })).optional(),
                })
            ),
            submitText: z.string(),
            successMessage: z.string(),
            errorMessage: z.string(),
            placeholders: z.object({
                name: z.string(),
                email: z.string(),
                phone: z.string(),
                company: z.string(),
                message: z.string(),
            }),
        }).optional(),
        office: z.object({
            title: z.string(),
            address: z.array(z.string()),
            email: z.string(),
            phone: z.string().optional(),
        }).optional(),
        // Network page fields
        valueProp: z.object({
            title: z.string(),
            description: z.string(),
            benefits: z.array(
                z.object({
                    title: z.string(),
                    description: z.string(),
                    icon: z.string(),
                })
            ),
        }).optional(),
        onboarding: z.object({
            title: z.string(),
            steps: z.array(
                z.object({
                    step: z.number(),
                    title: z.string(),
                    description: z.string(),
                })
            ),
        }).optional(),
        cta: z.object({
            title: z.string(),
            description: z.string(),
            button: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        // Impact page fields
        stats: z.array(
            z.object({
                value: z.string(),
                label: z.string(),
                prefix: z.string().optional(),
                suffix: z.string().optional(),
            })
        ).optional(),
        projects: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                image: z.object({
                    src: z.string(),
                    alt: z.string(),
                }),
                location: z.string(),
                category: z.string(),
                metrics: z.record(z.string(), z.union([z.string(), z.number()])),
            })
        ).optional(),
        // Consulting page fields
        backOffice: z.object({
            title: z.string(),
            description: z.string(),
            points: z.array(z.string()),
        }).optional(),
        serviceCategories: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                icon: z.string(),
                services: z.array(
                    z.object({
                        id: z.string(),
                        title: z.string(),
                        description: z.string(),
                    })
                ),
            })
        ).optional(),
        consulting: z.object({
            // Service cards
            services: z.array(
                z.object({
                    icon: z.string(),
                    title: z.string(),
                    description: z.string(),
                    tags: z.array(z.string()),
                    href: z.string().optional(),
                })
            ),
            // Deep dive accordion sections
            deepDive: z.object({
                headline: z.string(),
                items: z.array(
                    z.object({
                        title: z.string(),
                        description: z.string(),
                        details: z.array(z.string()),
                    })
                ),
            }),
            // Process steps
            process: z.object({
                headline: z.string(),
                steps: z.array(
                    z.object({
                        number: z.string(),
                        title: z.string(),
                        description: z.string(),
                    })
                ),
            }),
            // Statistics
            metrics: z.array(
                z.object({
                    metric: z.string(),
                    label: z.string(),
                })
            ),
            // Final CTA section
            finalCta: z.object({
                headline: z.string(),
                description: z.string(),
                buttonLabel: z.string(),
                buttonHref: z.string(),
            }),
        }).optional(),
        // Digital Transformation page fields
        tag: z.string().optional(),
        philosophy: z.object({
            headline: z.string(),
            description: z.string(),
        }).optional(),
        capabilities: z.object({
            headline: z.string(),
            description: z.string(),
            cards: z.array(
                z.object({
                    title: z.string(),
                    subtitle: z.string(),
                    description: z.string(),
                    keywords: z.array(z.string()),
                    icon: z.string(),
                })
            ),
        }).optional(),
        comparison: z.object({
            headline: z.string(),
            subtitle: z.string(),
            bottleneck: z.object({
                title: z.string(),
                items: z.array(z.string()),
            }),
            accelerator: z.object({
                title: z.string(),
                items: z.array(z.string()),
            }),
        }).optional(),
        techStack: z.object({
            headline: z.string(),
            description: z.string(),
            technologies: z.array(
                z.object({
                    name: z.string(),
                    category: z.string(),
                })
            ),
        }).optional(),
        standards: z.object({
            headline: z.string(),
            description: z.string(),
            certifications: z.array(
                z.object({
                    name: z.string(),
                    category: z.string(),
                })
            ),
        }).optional(),
        process: z.object({
            headline: z.string(),
            steps: z.array(
                z.object({
                    number: z.string(),
                    title: z.string(),
                    description: z.string(),
                })
            ),
        }).optional(),
        painPoints: z.array(z.string()).optional(),
        finalCta: z.object({
            headline: z.string(),
            description: z.string(),
            buttonLabel: z.string(),
            buttonHref: z.string(),
            painPoints: z.array(z.string()).optional(),
        }).optional(),
        // Insights page fields
        featured: z.string().optional(),
        posts: z.string().optional(),
        categories: z.array(z.string()).optional(),
    }),
});
const team = defineCollection({
    type: 'data',
    schema: z.object({
        name: z.string(),
        role: z.string(),
        stats: z.string(),
        bio: z.string(),
        linkedin: z.string().optional(),
    }),
});

export const collections = {
    insights,
    case_studies,
    settings,
    pages,
    team,
};
