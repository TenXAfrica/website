import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, hoverEffect = true }) => {
    return (
        <motion.div
            className={twMerge(
                'relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-tenx-gold/30 p-6',
                hoverEffect && 'hover:border-tenx-gold/80 transition-all duration-300',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
        >
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {children}
        </motion.div>
    );
};
