import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { Stat } from '../types/components';

interface StatsCounterProps {
    stats: Stat[];
    className?: string;
}

interface SingleStatProps {
    stat: Stat;
    index: number;
    shouldAnimate: boolean;
}

/**
 * Animated counter for displaying key metrics.
 * Numbers count up when scrolled into view.
 */
export const StatsCounter: React.FC<StatsCounterProps> = ({
    stats,
    className,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    return (
        <motion.div
            ref={ref}
            className={twMerge(
                'grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8',
                className
            )}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
        >
            {stats.map((stat, index) => (
                <SingleStat
                    key={stat.label}
                    stat={stat}
                    index={index}
                    shouldAnimate={isInView}
                />
            ))}
        </motion.div>
    );
};

const SingleStat: React.FC<SingleStatProps> = ({ stat, index, shouldAnimate }) => {
    const [count, setCount] = useState(0);
    const numericValue = parseFloat(stat.value.replace(/[^0-9.]/g, ''));
    const isNumeric = !isNaN(numericValue);
    const targetValue = isNumeric ? numericValue : 0;

    useEffect(() => {
        if (!shouldAnimate || !isNumeric) return;

        const duration = 2000; // 2 seconds
        const steps = 60;
        const increment = targetValue / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= targetValue) {
                setCount(targetValue);
                clearInterval(timer);
            } else {
                setCount(current);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [shouldAnimate, targetValue, isNumeric]);

    // Format the display value
    const displayValue = isNumeric
        ? (stat.value.includes('.')
            ? count.toFixed(1)
            : Math.floor(count).toString())
        : stat.value;

    return (
        <motion.div
            className="text-center p-4 md:p-6 bg-black/40 backdrop-blur-sm border border-white/5 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: index * 0.1, duration: 0.4 }}
        >
            <div className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-tenx-gold mb-2">
                {stat.prefix}
                {displayValue}
                {stat.suffix}
            </div>
            <div className="text-xs md:text-sm text-white/50 uppercase tracking-wider">
                {stat.label}
            </div>
        </motion.div>
    );
};
