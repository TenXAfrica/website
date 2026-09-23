import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BlogPost } from '../types/blog';
import { BlogCard, formatPostDate } from './BlogCard';

interface InsightsFilterProps {
    posts: BlogPost[];
    categories: string[];
}

const POSTS_PER_PAGE = 6;
const ALL = 'All';

const tabClass = (active: boolean) =>
    [
        't-label inline-flex min-h-11 items-center border-b-2 transition-colors duration-150',
        active
            ? 'border-tenx-gold text-vapor-white'
            : 'border-transparent text-text-muted hover:text-vapor-white',
    ].join(' ');

const pageButtonClass = (active: boolean) =>
    [
        't-small inline-flex h-11 min-w-11 items-center justify-center border-b-2 px-2 transition-colors duration-150',
        active
            ? 'border-tenx-gold text-vapor-white'
            : 'border-transparent text-text-muted hover:text-vapor-white',
    ].join(' ');

/**
 * Insights list with category tabs, text search and pagination.
 * Server-rendered with every post on page one, so it reads correctly before
 * (or without) hydration.
 */
export const InsightsFilter: React.FC<InsightsFilterProps> = ({ posts, categories }) => {
    const [activeCategory, setActiveCategory] = useState<string>(ALL);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredPosts = useMemo(() => {
        let result = posts;

        if (activeCategory !== ALL) {
            result = result.filter((post) =>
                post.tags.some((tag) => tag.toLowerCase() === activeCategory.toLowerCase())
            );
        }

        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            result = result.filter(
                (post) =>
                    post.title.toLowerCase().includes(term) ||
                    post.excerpt.toLowerCase().includes(term) ||
                    post.tags.some((tag) => tag.toLowerCase().includes(term)) ||
                    post.author.name.toLowerCase().includes(term)
            );
        }

        return result;
    }, [posts, activeCategory, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
    const paginatedPosts = useMemo(() => {
        const start = (currentPage - 1) * POSTS_PER_PAGE;
        return filteredPosts.slice(start, start + POSTS_PER_PAGE);
    }, [filteredPosts, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeCategory, searchTerm]);

    const goToPage = (page: number) => {
        setCurrentPage(Math.min(Math.max(page, 1), totalPages));
        const el = listRef.current;
        if (!el) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    };

    const describeFilter = () =>
        `${activeCategory !== ALL ? ` in ${activeCategory}` : ''}${searchTerm.trim() ? ` matching "${searchTerm.trim()}"` : ''}`;

    const pageNumbers = useMemo(() => {
        const all = Array.from({ length: totalPages }, (_, i) => i + 1);
        if (totalPages <= 7) return all;
        return all.filter(
            (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
        );
    }, [totalPages, currentPage]);

    return (
        <div>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                {categories.length > 0 && (
                    <div
                        role="group"
                        aria-label="Filter by topic"
                        className="flex flex-wrap gap-x-6 gap-y-2"
                    >
                        {[ALL, ...categories].map((category) => (
                            <button
                                key={category}
                                type="button"
                                aria-pressed={activeCategory === category}
                                onClick={() => setActiveCategory(category)}
                                className={tabClass(activeCategory === category)}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                )}

                <div className="w-full lg:max-w-xs">
                    <label htmlFor="insights-search" className="t-label block text-text-faint">
                        Search
                    </label>
                    <input
                        id="insights-search"
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Title, topic or author"
                        className="t-small mt-2 block h-12 w-full rounded-[2px] border border-border-interactive bg-surface-1 px-3 text-vapor-white placeholder:text-text-faint"
                    />
                </div>
            </div>

            <p role="status" aria-live="polite" className="t-caption mt-8 text-text-faint">
                {filteredPosts.length === 0
                    ? `No articles${describeFilter()}.`
                    : `Showing ${paginatedPosts.length} of ${filteredPosts.length} ${filteredPosts.length === 1 ? 'article' : 'articles'}${describeFilter()}.`}
            </p>

            <div
                ref={listRef}
                className="mt-6 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            >
                {paginatedPosts.map((post) => (
                    <BlogCard
                        key={post.id}
                        href={`/insights/${post.slug}`}
                        eyebrow={`${formatPostDate(post.publishedAt)} · ${post.readTime} min read`}
                        title={post.title}
                        excerpt={post.excerpt}
                        as="h2"
                    />
                ))}
            </div>

            {filteredPosts.length === 0 && (
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="t-small inline-flex min-h-11 items-center text-vapor-white underline underline-offset-4 transition-colors duration-150 hover:text-tenx-gold"
                        >
                            Clear search
                        </button>
                    )}
                    {activeCategory !== ALL && (
                        <button
                            type="button"
                            onClick={() => setActiveCategory(ALL)}
                            className="t-small inline-flex min-h-11 items-center text-vapor-white underline underline-offset-4 transition-colors duration-150 hover:text-tenx-gold"
                        >
                            Show all topics
                        </button>
                    )}
                </div>
            )}

            {filteredPosts.length > POSTS_PER_PAGE && (
                <nav
                    aria-label="Article pages"
                    className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6"
                >
                    <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="t-label inline-flex min-h-11 items-center text-vapor-white transition-colors duration-150 hover:text-tenx-gold disabled:cursor-not-allowed disabled:text-text-faint"
                    >
                        Previous
                    </button>

                    <ul className="flex flex-wrap items-center gap-2">
                        {pageNumbers.map((page, i) => (
                            <li key={page} className="flex items-center gap-2">
                                {i > 0 && page - pageNumbers[i - 1] > 1 && (
                                    <span aria-hidden="true" className="t-small text-text-faint">
                                        …
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => goToPage(page)}
                                    aria-current={page === currentPage ? 'page' : undefined}
                                    aria-label={`Page ${page}`}
                                    className={pageButtonClass(page === currentPage)}
                                >
                                    {page}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="t-label inline-flex min-h-11 items-center text-vapor-white transition-colors duration-150 hover:text-tenx-gold disabled:cursor-not-allowed disabled:text-text-faint"
                    >
                        Next
                    </button>
                </nav>
            )}
        </div>
    );
};
