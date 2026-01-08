import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AccordionItem {
	title: string;
	description: string;
	details: string[];
}

interface AccordionSectionProps {
	headline: string;
	items: AccordionItem[];
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
	headline,
	items,
}) => {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

	return (
		<section className="py-20 px-6 lg:px-12 border-t border-white/5">
			<div className="max-w-4xl mx-auto">
				{/* Headline */}
				<div className="mb-12">
					<div className="w-12 h-1 bg-tenx-gold mb-6" />
					<h2 className="text-3xl md:text-4xl font-heading font-bold text-white">
						{headline}
					</h2>
				</div>

				{/* Accordion */}
				<div className="space-y-4">
					{items.map((item, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 10 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ delay: index * 0.1, duration: 0.3 }}
							viewport={{ once: true }}
						>
							<button
								onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
								className="w-full"
							>
							<div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-md p-6 text-left hover:border-tenx-gold/40 hover:bg-gradient-to-r hover:from-white/10 hover:to-white/[0.05] transition-all duration-300">
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-heading font-bold text-white group-hover:text-tenx-gold transition-colors">
											{item.title}
										</h3>
										<motion.svg
											animate={{ rotate: expandedIndex === index ? 180 : 0 }}
											transition={{ duration: 0.3 }}
										className="w-6 h-6 text-tenx-gold"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 14l-7 7m0 0l-7-7m7 7V3"
											/>
										</motion.svg>
									</div>

									{/* Preview text */}
									<p className="text-white/60 text-sm mt-2 line-clamp-1">
										{item.description}
									</p>
								</div>
							</button>

							{/* Expanded content */}
							<AnimatePresence>
								{expandedIndex === index && (
									<motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										exit={{ opacity: 0, height: 0 }}
										transition={{ duration: 0.3 }}
										className="overflow-hidden"
									>
										<div className="rounded-b-xl border border-t-0 border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.01] backdrop-blur-md p-6 space-y-4">
											<p className="text-white/70 leading-relaxed">
												{item.description}
											</p>

											{/* Details list */}
											<ul className="space-y-3 mt-6">
												{item.details.map((detail, idx) => (
													<li key={idx} className="flex items-start gap-3">
														<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-tenx-gold/20 text-tenx-gold text-xs font-bold flex-shrink-0">
															✓
														</span>
														<span className="text-white/70 text-sm">
															{detail}
														</span>
													</li>
												))}
											</ul>

											{/* CTA */}
											<div className="pt-4 mt-6 border-t border-white/10">
												<a
													href="/contact?interest=consulting"
													className="inline-flex items-center gap-2 text-tenx-gold hover:text-white transition-colors font-semibold text-sm"
												>
													Learn more about this service
													<svg
														className="w-4 h-4"
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
												</a>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
};
