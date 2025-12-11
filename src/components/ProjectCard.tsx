import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { ImpactProject } from '../types/components';

interface ProjectCardProps {
    project: ImpactProject;
    index?: number;
    className?: string;
}

/**
 * Card for displaying impact projects with image, metrics, and location.
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    index = 0,
    className,
}) => {
    return (
        <motion.div
            className={twMerge(
                'group relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-white/10',
                'hover:border-tenx-gold/50 transition-all duration-500',
                className
            )}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
        >
            {/* Image section */}
            <div className="relative h-48 overflow-hidden">
                {/* Placeholder gradient if no image */}
                <div className="absolute inset-0 bg-gradient-to-br from-tenx-gold/20 via-slate-teal/20 to-obsidian-void" />

                {project.image?.src && (
                    <img
                        src={project.image.src}
                        alt={project.image.alt || project.title}
                        className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                    />
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {/* Category badge */}
                <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 text-xs font-mono uppercase tracking-wider bg-tenx-gold/90 text-black rounded-sm">
                        {project.category}
                    </span>
                </div>

                {/* Location */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white/80">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">{project.location}</span>
                </div>
            </div>

            {/* Content section */}
            <div className="p-6">
                <h3 className="text-xl font-heading font-bold text-white mb-2 group-hover:text-tenx-gold transition-colors">
                    {project.title}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-2">
                    {project.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                    {Object.entries(project.metrics).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="text-center">
                            <div className="text-lg font-bold text-tenx-gold">
                                {value}
                            </div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">
                                {key.replace(/_/g, ' ')}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};
