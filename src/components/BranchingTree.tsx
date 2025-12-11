import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
// Adjust path as needed
import circuitTreeImg from '../assets/circuit-tree.svg';

// --- Configuration ---
const COLORS = {
    gold: '#d68614',
    dark: '#0a0f14',
};

// --- Types ---
interface NodeData {
    id: string;
    label: string;
    subLabel: string;
    top: string;
    left: string;
    align: 'left' | 'right' | 'center';
    delay: number;
}

// --- Data ---
const NODES: NodeData[] = [
    {
        id: 'mgmt', label: 'MANAGEMENT CONSULTING', subLabel: 'Strategy & Advisory',
        top: '8%', left: '50%', align: 'center', delay: 1.2
    },
    {
        id: 'tech', label: 'DIGITAL & INNOVATION', subLabel: 'Transformation & IT Services',
        top: '28%', left: '18%', align: 'left', delay: 1.0
    },
    {
        id: 'fund', label: 'VENTURE FUNDING', subLabel: 'Capital & Incubation',
        top: '48%', left: '82%', align: 'right', delay: 0.8
    },
    {
        id: 'impact', label: 'SOCIAL IMPACT', subLabel: 'Rural Development & ESG',
        top: '68%', left: '50%', align: 'center', delay: 0.5
    },
];

// --- Sub-Component (The Glass Cards) ---
const CircuitNode: React.FC<{ data: NodeData; startAnimation: boolean }> = ({ data, startAnimation }) => {
    return (
        <motion.div
            // RESPONSIVE LAYOUT LOGIC:
            // 1. Mobile: w-40 or w-48 depending on screen real estate, removed extra padding to fit full width.
            // 2. Alignment logic ensures text flows away from the anchor point.
            className={`absolute z-20 flex flex-col justify-center pointer-events-auto
                ${data.align === 'right' ? 'items-end text-right -translate-x-full pr-1 md:pr-4 origin-right' :
                    data.align === 'left' ? 'items-start text-left pl-1 md:pl-4 origin-left' :
                        'items-center text-center -translate-x-1/2 origin-center'}
            `}
            style={{
                left: data.left,
                top: data.top,
                transform: data.align === 'center' ? 'translate(-50%, -50%)' : 'translateY(-50%)',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={startAnimation ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.8, delay: data.delay, ease: "easeOut" }}
        >
            <motion.div
                // Glass Card Styling
                // UPDATED: Used w-40 on small mobile to ensure no overflow on full-width view
                className="
                    relative rounded-lg border backdrop-blur-md bg-[#0a0f14]/80 transition-all duration-500
                    w-40 xs:w-48 md:w-64 lg:w-72 
                    p-2 md:p-4
                "
                animate={startAnimation ? {
                    borderColor: COLORS.gold,
                    boxShadow: "0 0 20px rgba(214,134,20,0.2)",
                } : {
                    borderColor: "rgba(255,255,255,0.1)",
                    boxShadow: "none",
                }}
            >
                {/* Responsive Text Sizes */}
                <h3 className="font-space font-bold uppercase tracking-widest text-[#d68614] mb-1
                               text-[9px] xs:text-[10px] md:text-xs lg:text-sm">
                    {data.label}
                </h3>
                <p className="font-outfit font-light text-white/70 leading-tight
                              text-[9px] xs:text-[10px] md:text-xs">
                    {data.subLabel}
                </p>
            </motion.div>
        </motion.div>
    );
};

// --- Main Component ---
export const BranchingTree = () => {
    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { amount: 0.2, once: true });

    return (
        <div
            ref={containerRef}
            // UPDATED: p-0 on mobile allows full width. md:p-8 adds spacing on desktop.
            className="w-full h-full flex items-center justify-center p-0 md:p-8"
        >
            {/* VITAL CONTAINER:
               1. w-full: Forces the diagram to take 100% of the screen width on mobile.
               2. max-w-[500px]: Keeps it looking sane on tablets/desktop (not too wide).
               3. aspect-[3/4]: Locks the aspect ratio to the SVG dimensions.
            */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                <svg className="w-full h-full">
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            <div className="relative w-full max-w-[500px] md:max-w-full aspect-[3/4] max-h-[90vh]">

                {/* The Circuit Image */}
                <motion.div
                    className="absolute inset-0 w-full h-full"
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 1.5 }}
                >
                    <img
                        src={circuitTreeImg.src}
                        alt="Circuit Tree Diagram"
                        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(214,134,20,0.3)]"
                    />
                </motion.div>

                {/* The Nodes Layer */}
                <div className="absolute inset-0 z-20 w-full h-full">
                    {NODES.map((node) => (
                        <CircuitNode
                            key={node.id}
                            data={node}
                            startAnimation={isInView}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};