import React from 'react';
import { GlassCard } from './GlassCard';
import { GoldButton } from './GoldButton';

// --- Assets ---
import consultingImg from '../assets/consulting.jpg';
import catalystImg from '../assets/catalyst.jpg';
import impactImg from '../assets/impact.jpg';

// Define the standard image classes for consistency across tiles
const standardImageClasses = "w-full h-full object-cover grayscale brightness-50 contrast-125 transition-all duration-700 group-hover:grayscale-0 group-hover:scale-110 group-hover:brightness-75";
const standardGradient = <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>;


export const BentoGrid: React.FC = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 relative z-10">

            {/* =========================================
                Tile 1: Consulting (Updated Hover)
            ========================================= */}
            <a href="/consulting" className="contents">
            <GlassCard className="col-span-1 md:col-span-2 lg:col-span-2 min-h-[300px] flex flex-col justify-end group cursor-pointer p-6 md:p-8 relative overflow-hidden">

                {/* --- Image Layer --- */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={consultingImg.src}
                        alt="Consulting"
                        // Applied standard hover effect classes
                        className={standardImageClasses}
                    />
                    {standardGradient}
                </div>

                {/* --- Content Layer --- */}
                <div className="relative z-20">
                    <div className="text-tenx-gold mb-2 text-3xl md:text-4xl">
                        <i className="ph ph-cpu"></i>
                    </div>
                    <h3 className="text-2xl font-heading font-bold mb-2 text-white group-hover:text-tenx-gold transition-colors">
                        Consulting
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed max-w-sm">
                        Digital Transformation & Strategic Infrastructure.
                    </p>
                </div>
            </GlassCard>
            </a>

            {/* =========================================
                Tile 2: Catalyst (Image Only, Updated Hover)
            ========================================= */}
            <a href="/catalyst" className="contents">
            <GlassCard className="col-span-1 md:col-span-1 lg:col-span-1 min-h-[300px] relative overflow-hidden group cursor-pointer">

                {/* --- Image Layer --- */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={catalystImg.src}
                        alt="Catalyst"
                        // Applied standard hover effect classes
                        className={standardImageClasses}
                    />
                    {/* Optional: keep gradient if you want the image slightly dimmed even without text */}
                    {standardGradient}
                </div>

                <div className="relative z-20 h-full flex flex-col justify-end">
                    <h3 className="text-xl font-heading font-bold mb-2 text-white group-hover:text-tenx-gold transition-colors">Catalyst</h3>
                    <p className="text-xs text-white/80 leading-relaxed">
                        Empowering 50K+ lives through sustainable tech.
                    </p>
                </div>

            </GlassCard>
            </a>

            {/* =========================================
                Tile 3: Impact (Reference Implementation)
            ========================================= */}
            <a href="/impact" className="contents">
            <GlassCard className="col-span-1 md:col-span-3 lg:col-span-1 min-h-[300px] relative overflow-hidden group p-6 cursor-pointer">

                {/* --- Image Layer --- */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={impactImg.src}
                        alt="Impact"
                        // Using standard classes (same as before)
                        className={standardImageClasses}
                    />
                    {standardGradient}
                </div>

                {/* --- Content Layer --- */}
                <div className="relative z-20 h-full flex flex-col justify-end">
                    <h3 className="text-xl font-heading font-bold mb-2 text-white group-hover:text-tenx-gold transition-colors">Impact</h3>
                    <p className="text-xs text-white/80 leading-relaxed">
                        Empowering 50K+ lives through sustainable tech.
                    </p>
                </div>
            </GlassCard>
            </a>

            {/* =========================================
                Tile 4: Network (Text Only - No changes)
            ========================================= */}
            <a href="/network" className="contents">
            <GlassCard className="col-span-1 md:col-span-2 lg:col-span-4 min-h-[auto] md:min-h-[200px] flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:px-10 gap-6 border-white/10 bg-obsidian-void/60 bg-gradient-to-r from-obsidian-void to-slate-teal/20">
                <div className="max-w-xl">
                    <h3 className="text-2xl md:text-3xl font-heading font-bold mb-2 text-white">THE IDC NETWORK</h3>
                    <p className="text-white/60 text-sm md:text-base">
                        Join 500+ elite consultants powering the continent's growth.
                    </p>
                </div>

                <div className="w-full md:w-auto">
                    <GoldButton variant="outline" className="w-full md:w-auto justify-center">
                        Join Network
                    </GoldButton>
                </div>
            </GlassCard>
            </a>

        </div>
    );
};