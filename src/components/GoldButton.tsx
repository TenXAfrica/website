import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface GoldButtonProps extends HTMLMotionProps<"button"> {
    variant?: 'solid' | 'outline' | 'ghost';
    children: React.ReactNode;
}

export const GoldButton: React.FC<GoldButtonProps> = ({
    children,
    variant = 'solid',
    className,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center px-6 py-3 min-h-[44px] rounded-sm font-bold uppercase tracking-wider text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-tenx-gold/50";

    const variants = {
        solid: "bg-tenx-gold text-black hover:bg-[#b06d10] hover:scale-105",
        outline: "border border-tenx-gold text-tenx-gold hover:bg-tenx-gold hover:text-black",
        ghost: "text-tenx-gold hover:bg-tenx-gold/10"
    };

    return (
        <motion.button
            className={twMerge(baseStyles, variants[variant], className)}
            whileTap={{ scale: 0.98 }}
            {...props}
        >
            {children}
        </motion.button>
    );
};
