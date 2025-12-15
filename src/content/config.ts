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
    }),
});
// Team members collection
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
    ventures,
    consultants,
    impact_stories,
    insights,
    settings,
    pages,
    team,
};
