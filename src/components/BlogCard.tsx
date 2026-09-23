import React from 'react';

interface BlogCardProps {
    /** Where the title links to, e.g. `/insights/how-we-price`. */
    href: string;
    /** Small uppercase line above the title, e.g. "23 Sep 2026 · 6 min read". */
    eyebrow: string;
    title: string;
    excerpt: string;
    /** Heading element for the title. Pages with an h1 and no section h2 use h2. */
    as?: 'h2' | 'h3';
    className?: string;
}

/**
 * Listing entry for Insights and Case studies.
 * No image and no card border: a hairline above, a label eyebrow, the title
 * as the link, and a two-line excerpt. Renders as static HTML when used from
 * Astro without a client directive.
 */
export const BlogCard: React.FC<BlogCardProps> = ({
    href,
    eyebrow,
    title,
    excerpt,
    as: Heading = 'h2',
    className = '',
}) => (
    <article className={`border-t border-rule pt-6 ${className}`}>
        <p className="t-label text-text-faint">{eyebrow}</p>
        <Heading className="t-h3 mt-3">
            <a
                href={href}
                className="-my-2 block py-2 text-vapor-white transition-colors duration-150 hover:text-tenx-gold"
            >
                {title}
            </a>
        </Heading>
        <p className="t-small mt-3 line-clamp-2 text-text-muted">{excerpt}</p>
    </article>
);

/** "23 Sep 2026". Dates in frontmatter are calendar dates, so format in UTC. */
export const formatPostDate = (value: string | Date): string =>
    new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
