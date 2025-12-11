import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { TeamMember as TeamMemberType } from '../types/components';

interface TeamMemberProps {
    member: TeamMemberType;
    index?: number;
    variant?: 'default' | 'compact';
    className?: string;
}

/**
 * Team member profile card with glassmorphism styling.
 * Shows photo placeholder, name, role, and stats.
 */
export const TeamMember: React.FC<TeamMemberProps> = ({
    member,
    index = 0,
    variant = 'default',
    className,
}) => {
    const isCompact = variant === 'compact';

    return (
        <motion.div
            className={twMerge(
                'group relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-white/10',
                'hover:border-tenx-gold/50 transition-all duration-300',
                isCompact ? 'p-4' : 'p-6',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
        >
            <div className="flex items-start gap-4">
                {/* Avatar placeholder */}
                <div
                    className={twMerge(
                        'relative flex-shrink-0 rounded-full bg-gradient-to-br from-tenx-gold/30 to-slate-teal/30 flex items-center justify-center',
                        'border border-tenx-gold/20 group-hover:border-tenx-gold/50 transition-colors',
                        isCompact ? 'w-12 h-12' : 'w-16 h-16'
                    )}
                >
                    {member.image ? (
                        <img
                            src={member.image.src}
                            alt={member.image.alt || member.name}
                            className="w-full h-full object-cover rounded-full"
                        />
                    ) : (
                        <span className={twMerge(
                            'font-heading font-bold text-tenx-gold',
                            isCompact ? 'text-lg' : 'text-xl'
                        )}>
                            {member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className={twMerge(
                        'font-heading font-bold text-white truncate',
                        isCompact ? 'text-base' : 'text-lg'
                    )}>
                        {member.name}
                    </h4>
                    <p className={twMerge(
                        'text-tenx-gold',
                        isCompact ? 'text-xs' : 'text-sm'
                    )}>
                        {member.role}
                    </p>

                    {member.stats && !isCompact && (
                        <p className="text-xs text-white/40 mt-2 font-mono">
                            {member.stats}
                        </p>
                    )}

                    {member.bio && !isCompact && (
                        <p className="text-sm text-white/60 mt-3 leading-relaxed line-clamp-2">
                            {member.bio}
                        </p>
                    )}
                </div>
            </div>

            {/* LinkedIn link */}
            {member.linkedin && !isCompact && (
                <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-4 right-4 text-white/30 hover:text-tenx-gold transition-colors"
                    aria-label={`View ${member.name}'s LinkedIn`}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                </a>
            )}
        </motion.div>
    );
};
