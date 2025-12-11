import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { OnboardingStep } from '../types/components';

interface OnboardingStepsProps {
    steps: OnboardingStep[];
    title?: string;
    className?: string;
}

/**
 * Visual step-by-step onboarding process display.
 * Shows numbered steps with connecting lines.
 */
export const OnboardingSteps: React.FC<OnboardingStepsProps> = ({
    steps,
    title,
    className,
}) => {
    return (
        <div className={twMerge('', className)}>
            {title && (
                <h3 className="text-2xl font-heading font-bold text-white mb-8">
                    {title}
                </h3>
            )}

            <div className="relative">
                {/* Vertical line connector (hidden on mobile) */}
                <div className="hidden md:block absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-tenx-gold via-tenx-gold/50 to-transparent" />

                <div className="space-y-6">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.step}
                            className="relative flex gap-6"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.4 }}
                        >
                            {/* Step number */}
                            <div className="relative z-10 flex-shrink-0">
                                <div className="w-16 h-16 rounded-xl bg-black/60 backdrop-blur-xl border border-tenx-gold/30 flex items-center justify-center">
                                    <span className="text-2xl font-heading font-bold text-tenx-gold">
                                        {step.step.toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-3">
                                <h4 className="text-lg font-heading font-bold text-white mb-1">
                                    {step.title}
                                </h4>
                                <p className="text-sm text-white/60 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface VentureCardProps {
    venture: {
        id: string;
        name: string;
        status: 'Incubation' | 'Funded' | 'Exited';
        description: string;
        sector?: string;
        metrics: Record<string, string | number>;
    };
    index?: number;
    className?: string;
}

/**
 * Card for displaying portfolio ventures in the Catalyst section.
 */
export const VentureCard: React.FC<VentureCardProps> = ({
    venture,
    index = 0,
    className,
}) => {
    const statusColors = {
        Incubation: 'bg-blue-500/20 text-blue-400 border-blue-400/30',
        Funded: 'bg-tenx-gold/20 text-tenx-gold border-tenx-gold/30',
        Exited: 'bg-green-500/20 text-green-400 border-green-400/30',
    };

    return (
        <motion.div
            className={twMerge(
                'group relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 p-6',
                'hover:border-tenx-gold/50 transition-all duration-300',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h4 className="text-lg font-heading font-bold text-white group-hover:text-tenx-gold transition-colors">
                        {venture.name}
                    </h4>
                    {venture.sector && (
                        <span className="text-xs text-white/40 uppercase tracking-wider">
                            {venture.sector}
                        </span>
                    )}
                </div>
                <span className={twMerge(
                    'px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded border',
                    statusColors[venture.status]
                )}>
                    {venture.status}
                </span>
            </div>

            {/* Description */}
            <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-2">
                {venture.description}
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                {Object.entries(venture.metrics).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="text-center">
                        <div className="text-sm font-bold text-tenx-gold">
                            {value}
                        </div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">
                            {key.replace(/_/g, ' ')}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
