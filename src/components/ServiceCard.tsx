import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { Service } from '../types/components';

interface ServiceCardProps {
    service: Service;
    index?: number;
    className?: string;
}

/**
 * Card component for displaying individual service offerings.
 * Features glassmorphism styling with hover effects.
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
    service,
    index = 0,
    className,
}) => {
    return (
        <motion.div
            className={twMerge(
                'group relative overflow-hidden rounded-xl bg-black/40 backdrop-blur-md border border-white/10 p-6',
                'hover:border-tenx-gold/50 hover:bg-black/60 transition-all duration-300',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
        >
            {/* Hover glow effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-tenx-gold/50 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                <h4 className="text-lg font-heading font-bold text-white mb-2 group-hover:text-tenx-gold transition-colors">
                    {service.title}
                </h4>
                <p className="text-sm text-white/60 leading-relaxed">
                    {service.description}
                </p>
            </div>

            {/* Corner accent */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r border-b border-tenx-gold/20 group-hover:border-tenx-gold/60 transition-colors" />
        </motion.div>
    );
};

interface ServiceCategoryCardProps {
    title: string;
    description: string;
    icon?: string;
    services: Service[];
    index?: number;
    className?: string;
}

/**
 * Larger card for displaying a category of services with its child services.
 */
export const ServiceCategoryCard: React.FC<ServiceCategoryCardProps> = ({
    title,
    description,
    services,
    index = 0,
    className,
}) => {
    return (
        <motion.div
            className={twMerge(
                'relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-tenx-gold/30 p-8',
                'hover:border-tenx-gold/60 transition-all duration-300',
                className
            )}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.15, duration: 0.5 }}
        >
            {/* Header */}
            <div className="mb-6">
                <h3 className="text-2xl font-heading font-bold text-white mb-2">
                    {title}
                </h3>
                <p className="text-white/60">
                    {description}
                </p>
            </div>

            {/* Services grid */}
            <div className="grid gap-4">
                {services.map((service, i) => (
                    <ServiceCard key={service.id} service={service} index={i} />
                ))}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-tenx-gold/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
};
