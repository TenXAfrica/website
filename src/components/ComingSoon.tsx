import React from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

export type MilestoneStatus = "complete" | "in-progress" | "queued";

export interface ComingSoonMilestone {
	label: string;
	eta?: string;
	status?: MilestoneStatus;
}

export interface ComingSoonProps {
	eyebrow?: string;
	headline: string;
	highlight?: string;
	description?: string;
	targetDate?: string;
	statusText?: string;
	primaryCta?: { label: string; href: string };
	secondaryCta?: { label: string; href: string };
	contactEmail?: string;
	milestones?: ComingSoonMilestone[];
	className?: string;
}

const statusStyles: Record<MilestoneStatus, string> = {
	complete: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
	"in-progress": "bg-tenx-gold/15 text-tenx-gold border border-tenx-gold/40",
	queued: "bg-white/5 text-white/70 border border-white/10",
};

const defaultMilestones: ComingSoonMilestone[] = [
	{ label: "Experience architecture locked in", status: "complete" },
	{ label: "Interface build and polish", status: "in-progress", eta: "This week" },
	{ label: "Early access invites", status: "queued", eta: "Next" },
];

export const ComingSoon: React.FC<ComingSoonProps> = ({
	eyebrow = "TEN X AFRICA",
	headline,
	highlight = "Coming Soon",
	description = "We are finalizing this experience. Expect the same Ten X craft—faster, clearer, and built for bold operators across the continent.",
	targetDate = "Launching shortly",
	statusText = "Building in public",
	primaryCta,
	secondaryCta,
	contactEmail = "hello@tenxafrica.co.za",
	milestones = defaultMilestones,
	className,
}) => {
	const completed = milestones.filter((m) => m.status === "complete").length;
	const progress = milestones.length
		? Math.max(10, Math.min(100, Math.round((completed / milestones.length) * 100)))
		: 10;

	return (
		<section
			className={twMerge(
				"relative z-10 max-w-6xl mx-auto px-6 py-20 lg:px-12",
				className,
			)}
		>
			<div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-tenx-gold/10 blur-3xl" aria-hidden />
			<div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" aria-hidden />

			<div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-start relative">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="space-y-6"
				>
					<div className="inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase text-white/60 bg-white/5 border border-white/10 rounded-full px-4 py-2">
						<span className="w-2 h-2 rounded-full bg-tenx-gold animate-pulse" />
						{statusText}
					</div>

					<h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-white leading-[1.1]">
						{headline}
						<span className="block text-tenx-gold mt-2">{highlight}</span>
					</h1>

					<p className="text-lg text-white/70 leading-relaxed max-w-3xl">{description}</p>

					<div className="flex flex-wrap items-center gap-3 text-sm">
						<span className="rounded-full bg-white/5 border border-white/10 px-4 py-2 text-white/70">
							{eyebrow}
						</span>
						<span className="rounded-full bg-tenx-gold/15 border border-tenx-gold/30 px-4 py-2 text-tenx-gold">
							{targetDate}
						</span>
					</div>

					<div className="flex flex-wrap gap-4 pt-2">
						{primaryCta && (
							<a
								href={primaryCta.href}
								className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-tenx-gold text-black font-semibold tracking-wide border border-tenx-gold/70 hover:-translate-y-0.5 transition-all"
							>
								{primaryCta.label}
							</a>
						)}
						{secondaryCta && (
							<a
								href={secondaryCta.href}
								className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-tenx-gold/60 hover:-translate-y-0.5 transition-all"
							>
								{secondaryCta.label}
							</a>
						)}
					</div>

					<div className="grid sm:grid-cols-3 gap-3 pt-6">
						<div className="rounded-2xl bg-white/5 border border-white/10 p-4">
							<p className="text-xs text-white/50">Status</p>
							<p className="text-lg text-white font-semibold mt-1">{statusText}</p>
						</div>
						<div className="rounded-2xl bg-white/5 border border-white/10 p-4">
							<p className="text-xs text-white/50">Target</p>
							<p className="text-lg text-white font-semibold mt-1">{targetDate}</p>
						</div>
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
					className="relative"
				>
					<div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-white/5 via-white/0 to-tenx-gold/10 blur-2xl" aria-hidden />
					<div className="relative rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl overflow-hidden">
						<div className="p-6 border-b border-white/5 flex items-center justify-between">
							<div>
								<p className="text-xs text-white/50">Progress</p>
								<p className="text-xl text-white font-semibold">{progress}%</p>
							</div>
							<div className="flex items-center gap-2 text-xs text-white/50">
								<span className="inline-flex h-2 w-2 rounded-full bg-tenx-gold" />
								Tracking milestones
							</div>
						</div>

						<div className="px-6 pt-6 pb-4">
							<div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
								<div
									className="h-full bg-gradient-to-r from-tenx-gold via-white to-tenx-gold rounded-full shadow-[0_0_20px_rgba(255,215,0,0.3)]"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="text-xs text-white/50 mt-2">{completed} of {milestones.length} milestones shipped</p>
						</div>

						<div className="divide-y divide-white/5">
							{milestones.map((milestone, index) => {
								const status = milestone.status || "queued";
								return (
									<div key={index} className="px-6 py-4 flex items-start gap-3">
										<div
											className={twMerge(
												"mt-1 h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-semibold",
												statusStyles[status],
											)}
										>
											{status === "complete" && "Done"}
											{status === "in-progress" && "Now"}
											{status === "queued" && "Next"}
										</div>
										<div className="flex-1">
											<p className="text-white font-medium">{milestone.label}</p>
											{milestone.eta && (
												<p className="text-xs text-white/50 mt-1">ETA: {milestone.eta}</p>
											)}
										</div>
									</div>
								);
							})}
						</div>

						<div className="px-6 py-5 bg-white/5 border-t border-white/10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-sm text-white font-semibold">Want early access?</p>
								<p className="text-xs text-white/60">Drop us a note and we will loop you in before launch.</p>
							</div>
							<a
								href={`mailto:${contactEmail}`}
								className="inline-flex gap-2 px-4 py-2 rounded-full bg-tenx-gold text-black text-sm font-semibold border border-tenx-gold/70 hover:-translate-y-0.5 transition-all"
							>
								Email
							</a>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
};
