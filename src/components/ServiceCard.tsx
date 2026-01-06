import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

export interface Service {
	id: string;
	title: string;
	description: string;
	icon?: React.ReactNode;
	tags?: string[];
}

export interface ServiceCardProps {
	icon: React.ReactNode;
	title: string;
	description: string;
	tags: string[];
	index?: number;
	href?: string;
	service?: any; // For backward compatibility
	className?: string;
}

/**
 * Card component for displaying individual service offerings.
 * Features glassmorphism styling with hover effects.
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
	icon,
	title,
	description,
	tags,
	index = 0,
	href,
	service, // For backward compatibility
	className,
}) => {
	// Support both new and old prop signatures
	const cardTitle = title || service?.title;
	const cardDesc = description || service?.description;
	const cardTags = tags || [];

	// Wrap in anchor if href is provided
	const CardContent = (
		<motion.div
			className={twMerge(
				'group',
				className
			)}
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.1, duration: 0.5 }}
			viewport={{ once: true }}
		>
			<div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-8 transition-all duration-300 hover:border-tenx-gold/60 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/[0.05]">
				{/* Glow effect on hover */}
				<div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-tenx-gold/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />

				{/* Icon */}
				{icon && (
				<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-tenx-gold/15 text-tenx-gold group-hover:bg-tenx-gold/25 transition-colors">
						<div className="text-3xl">{icon}</div>
					</div>
				)}

				{/* Title */}
			<h3 className="text-xl font-heading font-bold text-white mb-3 group-hover:text-tenx-gold transition-colors">
					{cardTitle}
				</h3>

				{/* Description */}
				<p className="text-white/70 text-sm leading-relaxed mb-6">
					{cardDesc}
				</p>

				{/* Tags */}
				{cardTags && cardTags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{cardTags.map((tag: string, idx: number) => (
							<span
								key={idx}
								className="inline-flex items-center rounded-full bg-tenx-gold/10 px-3 py-1 text-xs font-medium text-tenx-gold border border-tenx-gold/30"
							>
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Arrow indicator */}
				<div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
					<svg
					className="w-5 h-5 text-tenx-gold group-hover:translate-x-1 transition-transform"
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
				</div>
			</div>
		</motion.div>
	);

	if (href) {
		return (
			<a href={href} className="block">
				{CardContent}
			</a>
		);
	}

	return CardContent;
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
                    <ServiceCard key={service.id} service={service} index={i} icon={undefined} title={''} description={''} tags={[]} />
                ))}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-tenx-gold/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
};
