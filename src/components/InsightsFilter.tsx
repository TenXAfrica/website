import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BlogPost } from '../types/blog';
import { BlogCard } from './BlogCard';

interface InsightsFilterProps {
    posts: BlogPost[];
    categories: string[];
}

const POSTS_PER_PAGE = 6;

/**
 * Interactive blog post filter, search, and pagination component.
 * Handles category filtering, search with lazy loading and pagination.
 */
export const InsightsFilter: React.FC<InsightsFilterProps> = ({ posts, categories }) => {
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Filter posts based on category and search term
    const filteredPosts = useMemo(() => {
        let result = posts;

        // Category filter
        if (activeCategory !== 'All') {
            result = result.filter(post =>
                post.tags.some(tag =>
                    tag.toLowerCase() === activeCategory.toLowerCase()
                )
            );
        }

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(post =>
                post.title.toLowerCase().includes(term) ||
                post.excerpt.toLowerCase().includes(term) ||
                post.tags.some(tag => tag.toLowerCase().includes(term)) ||
                post.author.name.toLowerCase().includes(term)
            );
        }

        return result;
    }, [posts, activeCategory, searchTerm]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
    const paginatedPosts = useMemo(() => {
        const startIdx = (currentPage - 1) * POSTS_PER_PAGE;
        const endIdx = startIdx + POSTS_PER_PAGE;
        return filteredPosts.slice(startIdx, endIdx);
    }, [filteredPosts, currentPage]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [activeCategory, searchTerm]);

    const scrollToArticles = () => {
        // Scroll to the articles section, not the top of the page
        const articlesSection = document.querySelector('section.py-16.px-6.lg\\:px-12');
        if (articlesSection) {
            const offset = 100; // Leave some space from the top
            const elementPosition = articlesSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const handlePreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
        scrollToArticles();
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
        scrollToArticles();
    };

    return (
        <>
            {/* Search Bar */}
            <section className="py-8 px-6 lg:px-12 border-t border-white/5 bg-black/20">
                <div className="max-w-6xl mx-auto">
                    <div className="relative mb-6">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search articles by title, tag, or author..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-tenx-gold/50 focus:outline-none focus:ring-1 focus:ring-tenx-gold/50 transition-colors"
                        />
                    </div>
                </div>
            </section>

            {/* Category Filters */}
            <section className="py-8 px-6 lg:px-12 border-t border-white/5 bg-black/20">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setActiveCategory('All')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeCategory === 'All'
                                    ? 'bg-tenx-gold text-black'
                                    : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
                                }`}
                        >
                            All
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeCategory === category
                                        ? 'bg-tenx-gold text-black'
                                        : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Articles Grid */}
            <section className="py-16 px-6 lg:px-12">
                <div className="max-w-6xl mx-auto">
                    {/* Results count */}
                    <div className="mb-6 text-sm text-white/40">
                        Showing {paginatedPosts.length} of {filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'}
                        {activeCategory !== 'All' && ` in "${activeCategory}"`}
                        {searchTerm && ` matching "${searchTerm}"`}
                    </div>

                    {/* Grid with animations */}
                    <motion.div
                        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                        layout
                    >
                        <AnimatePresence mode="popLayout">
                            {paginatedPosts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                    <BlogCard
                                        post={post}
                                        index={index}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>

                    {/* Empty state */}
                    {filteredPosts.length === 0 && (
                        <motion.div
                            className="text-center py-16"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <p className="text-white/40 text-lg">
                                No articles found
                                {activeCategory !== 'All' && ` in "${activeCategory}"`}
                                {searchTerm && ` matching "${searchTerm}"`}
                            </p>
                            <div className="mt-4 flex gap-4 justify-center flex-wrap">
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="text-tenx-gold hover:underline"
                                    >
                                        Clear search
                                    </button>
                                )}
                                {activeCategory !== 'All' && (
                                    <button
                                        onClick={() => setActiveCategory('All')}
                                        className="text-tenx-gold hover:underline"
                                    >
                                        View all categories
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Pagination Controls */}
                    {filteredPosts.length > POSTS_PER_PAGE && (
                        <motion.div
                            className="mt-12 flex flex-col gap-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {/* Page Info - Mobile First */}
                            <div className="text-center">
                                <div className="text-sm text-white/60 mb-3">
                                    Page <span className="text-tenx-gold font-bold">{currentPage}</span> of <span className="text-tenx-gold font-bold">{totalPages}</span>
                                </div>
                                {/* Page Numbers - Show limited on mobile */}
                                <div className="flex gap-2 justify-center flex-wrap max-w-md mx-auto">
                                    {totalPages <= 7 ? (
                                        // Show all pages if 7 or fewer
                                        Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                            <button
                                                key={page}
                                                onClick={() => {
                                                    setCurrentPage(page);
                                                    scrollToArticles();
                                                }}
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${page === currentPage
                                                        ? 'bg-tenx-gold text-black'
                                                        : 'text-white/60 bg-white/5 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))
                                    ) : (
                                        // Smart pagination for many pages
                                        <>
                                            {/* First page */}
                                            <button
                                                onClick={() => {
                                                    setCurrentPage(1);
                                                    scrollToArticles();
                                                }}
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${1 === currentPage
                                                        ? 'bg-tenx-gold text-black'
                                                        : 'text-white/60 bg-white/5 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                1
                                            </button>

                                            {currentPage > 3 && (
                                                <span className="text-white/40 px-2">...</span>
                                            )}

                                            {/* Pages around current */}
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => 
                                                    page !== 1 && 
                                                    page !== totalPages && 
                                                    Math.abs(page - currentPage) <= 1
                                                )
                                                .map((page) => (
                                                    <button
                                                        key={page}
                                                        onClick={() => {
                                                            setCurrentPage(page);
                                                            scrollToArticles();
                                                        }}
                                                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${page === currentPage
                                                                ? 'bg-tenx-gold text-black'
                                                                : 'text-white/60 bg-white/5 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))
                                            }

                                            {currentPage < totalPages - 2 && (
                                                <span className="text-white/40 px-2">...</span>
                                            )}

                                            {/* Last page */}
                                            <button
                                                onClick={() => {
                                                    setCurrentPage(totalPages);
                                                    scrollToArticles();
                                                }}
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${totalPages === currentPage
                                                        ? 'bg-tenx-gold text-black'
                                                        : 'text-white/60 bg-white/5 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {totalPages}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Navigation Buttons */}
                            <div className="flex items-center justify-between gap-4">
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1}
                                    className={`px-4 sm:px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm sm:text-base ${currentPage === 1
                                            ? 'text-white/30 cursor-not-allowed'
                                            : 'text-white bg-white/5 hover:bg-tenx-gold hover:text-black'
                                        }`}
                                >
                                    <svg
                                        className="w-4 h-4 sm:w-5 sm:h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                    <span className="hidden sm:inline">Previous</span>
                                    <span className="sm:hidden">Prev</span>
                                </button>

                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className={`px-4 sm:px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm sm:text-base ${currentPage === totalPages
                                            ? 'text-white/30 cursor-not-allowed'
                                            : 'text-white bg-white/5 hover:bg-tenx-gold hover:text-black'
                                        }`}
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <span className="sm:hidden">Next</span>
                                    <svg
                                        className="w-4 h-4 sm:w-5 sm:h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </section>
        </>
    );
};

