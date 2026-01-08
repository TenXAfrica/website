import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface GetStartedPillar {
	id: string;
	title: string;
	description: string;
	href: string;
	icon?: string;
}

const defaultPillars: GetStartedPillar[] = [
	{
		id: 'consulting',
		title: 'Consulting',
		description: 'Strategic advisory and digital transformation for enterprises.',
		href: '/consulting',
	},
	{
		id: 'venture-studio',
		title: 'Venture Studio',
		description: 'Build and scale startups with our hands-on support.',
		href: '/venture-studio',
	},
	{
		id: 'network',
		title: 'Partner Network',
		description: 'Join our network of bold operators across Africa.',
		href: '/partner-network',
	},
];

interface GetStartedModalProps {
	isOpen: boolean;
	onClose: () => void;
	pillars?: GetStartedPillar[];
}

export const GetStartedModal: React.FC<GetStartedModalProps> = ({
	isOpen,
	onClose,
	pillars = defaultPillars,
}) => {
	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={onClose}
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ duration: 0.3, ease: 'easeOut' }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4"
					>
						<div className="relative w-full max-w-2xl">
							{/* Glow backdrop */}
							<div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-tenx-gold/20 to-white/5 blur-2xl opacity-50" />

							{/* Modal content */}
							<div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-black/80 to-obsidian-void/90 backdrop-blur-xl shadow-2xl p-8 lg:p-12">
								{/* Close button */}
								<button
									onClick={onClose}
									className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors"
									aria-label="Close modal"
								>
									<svg
										className="w-5 h-5 text-white/70 hover:text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>

								{/* Header */}
								<div className="mb-8 sm:mb-10 pr-6 sm:pr-8">
									<h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-white mb-2 sm:mb-3">
										Get Started
									</h2>
									<p className="text-white/60 text-sm sm:text-lg">
										Choose your path to transformation and impact.
									</p>
								</div>

								{/* Pillars Grid */}
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
									{pillars.map((pillar, index) => (
										<motion.a
											key={pillar.id}
											href={pillar.href}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: index * 0.1, duration: 0.4 }}
											className="group relative"
										>
											{/* Card glow */}
											<div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-tenx-gold/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

											{/* Card */}
											<div className="relative rounded-xl sm:rounded-2xl border border-white/10 bg-black/40 hover:bg-black/60 backdrop-blur p-4 sm:p-6 transition-all duration-300 h-full flex flex-col">
												{/* Badge */}
												<div className="inline-flex items-center gap-2 mb-3 sm:mb-4 w-fit">
													<span className="w-2 h-2 rounded-full bg-tenx-gold" />
													<span className="text-xs tracking-widest uppercase text-tenx-gold font-semibold">
														Pillar
													</span>
												</div>

												{/* Title */}
												<h3 className="text-lg sm:text-xl font-heading font-bold text-white mb-2 sm:mb-3 group-hover:text-tenx-gold transition-colors">
													{pillar.title}
												</h3>

												{/* Description */}
												<p className="text-xs sm:text-sm text-white/60 mb-4 sm:mb-6 flex-grow">
													{pillar.description}
												</p>

												{/* Arrow */}
												<div className="flex items-center gap-2 text-tenx-gold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
													<span className="text-xs sm:text-sm font-semibold">Explore</span>
													<svg
														className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform"
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
										</motion.a>
									))}
								</div>

								{/* Footer note */}
								<div className="mt-6 sm:mt-10 pt-4 sm:pt-8 border-t border-white/10">
									<p className="text-xs text-white/40 text-center">
										Questions? <a href="/contact" className="text-tenx-gold hover:underline">Get in touch</a> with our team.
									</p>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};
