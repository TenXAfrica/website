import { defineCollection, z } from 'astro:content';

const ventures = defineCollection({
    type: 'data',
    schema: z.object({
        name: z.string(),
        logo: z.string().optional(),
        status: z.enum(['Incubation', 'Funded', 'Exited']),
        metrics: z.record(z.string(), z.string().or(z.number())),
        description: z.string(),
    }),
});

const consultants = defineCollection({
    type: 'data',
    schema: z.object({
        name: z.string(),
        specialization: z.string(),
        location: z.string(),
        availability: z.enum(['Available', 'Busy', 'Open to Offers']),
        image: z.string().optional(),
    }),
});

const impact_stories = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        coverImage: z.string(),
        summary: z.string(),
    }),
});

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
    }),
});

// Global site settings (navigation, footer, social links)
const settings = defineCollection({
    type: 'content',
    schema: z.object({
        navigation: z.array(
            z.object({
                label: z.string(),
                href: z.string(),
                children: z.array(
                    z.object({
                        label: z.string(),
                        href: z.string(),
                    })
                ).optional(),
            })
        ),
        footer: z.object({
            columns: z.array(
                z.object({
                    title: z.string(),
                    links: z.array(
                        z.object({
                            label: z.string(),
                            href: z.string(),
                            external: z.boolean().optional(),
                        })
                    ),
                })
            ),
            newsletter: z.object({
                title: z.string(),
                placeholder: z.string(),
                buttonText: z.string(),
            }),
            copyright: z.string(),
            socials: z.array(
                z.object({
                    platform: z.enum(['linkedin', 'twitter', 'facebook', 'instagram']),
                    url: z.string(),
                })
            ),
        }),
        quickLinks: z.array(
            z.object({
                label: z.string(),
                href: z.string(),
            })
        ),
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
        networkRoles: z.object({
            title: z.string(),
            description: z.string(),
            roles: z.array(
                z.object({
                    title: z.string(),
                    description: z.string(),
                    focus: z.string(),
                })
            ),
        }).optional(),
        idealCandidate: z.object({
            title: z.string(),
            description: z.string(),
            criteria: z.array(z.string()),
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
        fundingModel: z.object({
            title: z.string(),
            description: z.string(),
            pillars: z.array(
                z.object({
                    title: z.string(),
                    description: z.string(),
                    icon: z.string(),
                })
            ),
        }).optional(),
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
        esg: z.object({
            title: z.string(),
            description: z.string(),
            downloadLink: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
        }).optional(),
        // Catalyst page fields
        forStartups: z.object({
            title: z.string(),
            description: z.string(),
            benefits: z.array(z.string()),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        forInvestors: z.object({
            title: z.string(),
            description: z.string(),
            benefits: z.array(z.string()),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        portfolio: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                status: z.enum(['Incubation', 'Funded', 'Exited']),
                description: z.string(),
                sector: z.string(),
                metrics: z.record(z.string(), z.union([z.string(), z.number()])),
            })
        ).optional(),
        // Venture Studio Fork structure
        foundations: z.object({
            headline: z.string(),
            tagline: z.string(),
            subtitle: z.string(),
            description: z.string(),
            services: z.array(z.string()),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        catalyst: z.object({
            headline: z.string(),
            tagline: z.string(),
            subtitle: z.string(),
            description: z.string(),
            services: z.array(z.string()),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        bridge: z.object({
            headline: z.string(),
            description: z.string(),
        }).optional(),
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
        // Services field (used by compliance & incubation pages with different structures)
        services: z.union([
            // Compliance page structure
            z.object({
                headline: z.string(),
                description: z.string(),
                categories: z.array(
                    z.object({
                        title: z.string(),
                        icon: z.string(),
                        items: z.array(z.string()),
                    })
                ),
            }),
            // Incubation page structure
            z.object({
                headline: z.string(),
                description: z.string().optional(),
                cards: z.array(
                    z.object({
                        title: z.string(),
                        icon: z.string(),
                        subtitle: z.string(),
                        description: z.string(),
                        keywords: z.array(z.string()),
                    })
                ),
            }),
        ]).optional(),
        // Pricing field (compliance page)
        pricing: z.object({
            headline: z.string(),
            tiers: z.array(
                z.object({
                    name: z.string(),
                    price: z.string(),
                    description: z.string(),
                    features: z.array(z.string()),
                    featured: z.boolean().optional(),
                    cta: z.object({
                        label: z.string(),
                        href: z.string(),
                    }),
                })
            ),
        }).optional(),
        // Programs field (incubation page)
        programs: z.object({
            headline: z.string(),
            description: z.string(),
            tracks: z.array(
                z.object({
                    title: z.string(),
                    icon: z.string(),
                    stage: z.string(),
                    duration: z.string(),
                    deliverables: z.array(z.string()),
                    outcomes: z.array(z.string()),
                })
            ),
        }).optional(),
        // Home page fields (used only by pages/index)
        ecosystem: z.object({
            title: z.string(),
        }).optional(),
        engine: z.object({
            headline: z.string(),
            headlineSecondary: z.string(),
            description: z.string(),
            pillars: z.array(z.string()),
        }).optional(),
        hybridModel: z.object({
            title: z.string(),
            descriptionPrimary: z.string(),
            descriptionSecondary: z.string(),
            steps: z.array(z.string()),
        }).optional(),
        footprint: z.object({
            title: z.string(),
            description: z.string(),
            stats: z.array(
                z.object({
                    value: z.string(),
                    label: z.string(),
                })
            ),
        }).optional(),
        leadership: z.object({
            title: z.string(),
            description: z.string(),
        }).optional(),
        idcNetwork: z.object({
            title: z.string(),
            quote: z.string(),
            description: z.string(),
            cta: z.object({
                label: z.string(),
                href: z.string(),
            }),
        }).optional(),
        // Insights page fields
        featured: z.string().optional(),
        posts: z.string().optional(),
        categories: z.array(z.string()).optional(),

        // Coming Soon page fields
        comingSoon: z.object({
            eyebrow: z.string().optional(),
            headline: z.string(),
            highlight: z.string().optional(),
            description: z.string().optional(),
            targetDate: z.string().optional(),
            statusText: z.string().optional(),
            contactEmail: z.string().email().optional(),
            primaryCta: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
            secondaryCta: z.object({
                label: z.string(),
                href: z.string(),
            }).optional(),
            milestones: z.array(
                z.object({
                    label: z.string(),
                    eta: z.string().optional(),
                    status: z.enum(['complete', 'in-progress', 'queued']).optional(),
                })
            ).optional(),
        }).optional(),
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

// Terminal Forms collection for data-driven chat forms
const terminal_forms = defineCollection({
    type: 'data',
    schema: z.object({
        // Form metadata
        slug: z.string(),
        title: z.string(),
        description: z.string().optional(),
        
        // Form behavior
        webhookUrl: z.string().url(),
        emailCheckWebhookUrl: z.string().url().optional(),
        trackingParams: z.array(z.string()).default(['token', 'utm_source', 'utm_medium', 'utm_campaign']),
        errorMessages: z.object({
            invalidCaptcha: z.string().optional(),
            processingError: z.string().optional(),
            generic: z.string().optional(),
        }).optional(),
        requireTurnstile: z.boolean().default(true),
        backButtonHref: z.string().default('/'),
        backButtonLabel: z.string().default('Back'),
        
        // Theming
        theme: z.object({
            versionTag: z.string().default('SECURE_UPLINK_V4.2'),
        }).optional(),
        
        // Stages (ordered list)
        stages: z.array(z.object({
            id: z.string(),
            prompt: z.string(),
            historyLabel: z.string(),
            fields: z.array(z.object({
                name: z.string(),
                type: z.enum(['text', 'email', 'phone', 'url', 'textarea', 'radio', 'select', 'file']),
                placeholder: z.string().optional(),
                label: z.string().optional(),
                required: z.boolean().optional(),
                minLength: z.number().optional(),
                options: z.array(z.object({
                    value: z.string(),
                    label: z.string(),
                })).optional(),
                toggleLabel: z.string().optional(),
                // File-specific options
                accept: z.string().optional(),
                multiple: z.boolean().optional(),
                maxSizeMB: z.number().optional(),
                helperText: z.string().optional(),
            })).optional(),
            advanceButton: z.object({
                label: z.string().optional(),
                showOnMobile: z.boolean().optional(),
            }).optional(),
        })),
        
        // Success state
        success: z.object({
            headline: z.string(),
            message: z.string(),
            ctaLabel: z.string().optional(),
            ctaHref: z.string().optional(),
        }),
    }),
});

export const collections = {
    insights,
    settings,
    pages,
    team,
    terminal_forms,
};
