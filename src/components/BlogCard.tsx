import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { BlogPost } from '../types/blog';

interface BlogCardProps {
    post: BlogPost;
    index?: number;
    variant?: 'default' | 'featured';
    className?: string;
}

/**
 * Blog post preview card with image, title, excerpt, and metadata.
 */
export const BlogCard: React.FC<BlogCardProps> = ({
    post,
    index = 0,
    variant = 'default',
    className,
}) => {
    const isFeatured = variant === 'featured';

    return (
        <motion.a
            href={`/insights/${post.slug}`}
            className={twMerge(
                'group block relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-white/10',
                'hover:border-tenx-gold/50 transition-all duration-300',
                isFeatured ? 'md:flex' : '',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
        >
            {/* Image */}
            <div className={twMerge(
                'relative overflow-hidden',
                isFeatured ? 'md:w-1/2 h-64 md:h-auto' : 'h-48'
            )}>
                {/* Placeholder gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-tenx-gold/20 via-slate-teal/20 to-obsidian-void" />

                {post.image?.src && (
                    <img
                        src={post.image.src}
                        alt={post.image.alt || post.title}
                        className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                    />
                )}

                {/* Reading time badge */}
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white/80">
                    {post.readTime} min read
                </div>
            </div>

            {/* Content */}
            <div className={twMerge(
                'p-6',
                isFeatured ? 'md:w-1/2 md:flex md:flex-col md:justify-center md:p-8' : ''
            )}>
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.slice(0, 3).map(tag => (
                        <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-tenx-gold bg-tenx-gold/10 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Title */}
                <h3 className={twMerge(
                    'font-heading font-bold text-white group-hover:text-tenx-gold transition-colors mb-2',
                    isFeatured ? 'text-2xl md:text-3xl' : 'text-lg'
                )}>
                    {post.title}
                </h3>

                {/* Excerpt */}
                <p className={twMerge(
                    'text-white/60 leading-relaxed mb-4',
                    isFeatured ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'
                )}>
                    {post.excerpt}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-white/40">
                    {/* Author */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-tenx-gold/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-tenx-gold">
                                {post.author.name.split(' ').map(n => n[0]).join('')}
                            </span>
                        </div>
                        <span>{post.author.name}</span>
                    </div>

                    {/* Date */}
                    <span>
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </span>
                </div>
            </div>
        </motion.a>
    );
};
