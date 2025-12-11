import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface PageHeroProps {
    headline: string;
    subheadline?: string;
    className?: string;
    children?: React.ReactNode;
}

/**
 * Reusable hero section component for internal pages.
 * Features the signature Ten X styling with animated entrance.
 */
export const PageHero: React.FC<PageHeroProps> = ({
    headline,
    subheadline,
    className,
    children,
}) => {
    return (
        <section
            className={twMerge(
                'relative min-h-[50vh] flex flex-col justify-center px-6 py-20 lg:px-12',
                className
            )}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-obsidian-void via-obsidian-void/95 to-transparent pointer-events-none" />

            <div className="relative z-10 max-w-5xl mx-auto w-full">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                    {/* Gold accent line */}
                    <div className="w-16 h-1 bg-tenx-gold mb-8" />

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight text-white leading-tight mb-6">
                        {headline.split('.').map((part, i, arr) => (
                            <span key={i}>
                                {part}
                                {i < arr.length - 1 && '.'}
                                {i < arr.length - 1 && <br />}
                            </span>
                        ))}
                    </h1>

                    {subheadline && (
                        <motion.p
                            className="text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                        >
                            {subheadline}
                        </motion.p>
                    )}

                    {children && (
                        <motion.div
                            className="mt-8"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                        >
                            {children}
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </section>
    );
};
