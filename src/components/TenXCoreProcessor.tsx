import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

// --- Configuration ---
const COLORS = {
    gold: '#d68614',
    dark: '#0a0f14',
    tealDark: '#2F4858',
};

const ANIMATION_DURATION = 2;

// --- Types ---
interface NodeData {
    id: string;
    label: string;
    subLabel: string;
    x: number;
    y: number;
    align: 'left' | 'right' | 'center';
    delay: number;
}

// --- Data ---
// Y-Positions are locked to match the path anchors perfectly
const DESKTOP_NODES: NodeData[] = [
    { id: 'step1', label: 'STRATEGIC ADVISORY', subLabel: 'The Plan', x: 50, y: 10, align: 'center', delay: 0 },
    { id: 'step2', label: 'TECHNOLOGY', subLabel: 'The Build', x: 15, y: 35, align: 'left', delay: 0.35 },
    { id: 'step3', label: 'CAPITAL', subLabel: 'The Fuel', x: 85, y: 65, align: 'right', delay: 0.65 },
    { id: 'step4', label: 'IMPACT', subLabel: 'The Legacy', x: 50, y: 90, align: 'center', delay: 1 },
];

const MOBILE_NODES: NodeData[] = [
    { id: 'step1', label: 'STRATEGIC ADVISORY', subLabel: 'The Plan', x: 50, y: 10, align: 'center', delay: 0 },
    { id: 'step2', label: 'TECHNOLOGY', subLabel: 'The Build', x: 50, y: 35, align: 'center', delay: 0.35 },
    { id: 'step3', label: 'CAPITAL', subLabel: 'The Fuel', x: 50, y: 60, align: 'center', delay: 0.65 },
    { id: 'step4', label: 'IMPACT', subLabel: 'The Legacy', x: 50, y: 90, align: 'center', delay: 1 },
];
// --- Sub-Components ---

const CircuitNode: React.FC<{ data: NodeData; startAnimation: boolean; isFinale?: boolean; isMobile: boolean }> = ({ data, startAnimation, isFinale, isMobile }) => {
    return (
        <motion.div
            className={`absolute transform -translate-y-1/2 z-20 flex flex-col justify-center
        ${data.align === 'right' ? 'items-end text-right -translate-x-full pr-6' :
                    data.align === 'left' ? 'items-start text-left pl-6' :
                        'items-center text-center -translate-x-1/2'}
      `}
            style={{
                left: `${data.x}%`,
                top: `${data.y}%`,
                width: isMobile ? '80vw' : '300px',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={startAnimation ? { opacity: 1, y: 0 } : { opacity: 0.3, y: 20 }}
            transition={{ duration: 0.6, delay: data.delay * ANIMATION_DURATION }}
        >
            <motion.div
                className="relative w-full p-4 rounded-lg border backdrop-blur-md bg-[#0a0f14]/80 transition-all duration-500"
                animate={startAnimation ? {
                    borderColor: COLORS.gold,
                    boxShadow: "0 0 30px rgba(214,134,20,0.15)",
                    backgroundColor: "rgba(10, 15, 20, 0.9)"
                } : {
                    borderColor: "rgba(255,255,255,0.1)",
                    boxShadow: "none",
                    backgroundColor: "rgba(10, 15, 20, 0.4)"
                }}
            >
                <motion.h3
                    className="font-space text-xs md:text-sm font-bold uppercase tracking-widest mb-1"
                    animate={{ color: startAnimation ? COLORS.gold : "rgba(255,255,255,0.8)" }}
                >
                    {data.label}
                </motion.h3>
                <p className="font-outfit text-[10px] md:text-xs font-light text-white/60 leading-tight">
                    {data.subLabel}
                </p>
            </motion.div>

            {!isMobile && (
                <motion.div
                    className={`absolute top-1/2 w-2.5 h-2.5 rounded-full bg-tenx-gold border border-black
            ${data.align === 'right' ? '-right-1' : data.align === 'left' ? '-left-1' : 'hidden'}
          `}
                    initial={{ scale: 0 }}
                    animate={{ scale: startAnimation ? 1 : 0 }}
                    transition={{ delay: data.delay * ANIMATION_DURATION }}
                />
            )}
        </motion.div>
    );
};

// --- Main Component ---

export const TenXCoreProcessor: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const isInView = useInView(containerRef, { amount: 0.3, once: true });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // --- THE PATH FIX ---
    // I have recalculated these curves to use 'Symmetric Vertical Tangents'.
    // This means the curve enters and exits every node perfectly vertically.
    // 1. Top (50,10) to Left (15,35): Midpoint is Y=22.5. 
    // 2. Left (15,35) to Right (85,65): Midpoint is Y=50.
    // 3. Right (85,65) to Bottom (50,90): Midpoint is Y=77.5.

    const desktopPath = `
    M 50 10
    C 50 22.5, 15 22.5, 15 35
    C 15 50, 85 50, 85 65
    C 85 77.5, 50 77.5, 50 90
  `;

    const mobilePath = `M 50 10 V 90`;

    const currentNodes = isMobile ? MOBILE_NODES : DESKTOP_NODES;
    const currentPath = isMobile ? mobilePath : desktopPath;

    return (
        <div ref={containerRef} className="relative w-full h-[850px] md:h-full bg-transparent overflow-hidden">

            {/* Background Grid */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                <svg className="w-full h-full">
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* SVG Circuit Layer */}
            <div className="absolute inset-0 z-10 w-full h-full">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* 1. Background Track (Dark Teal) */}
                    <path
                        d={currentPath}
                        fill="none"
                        stroke={COLORS.tealDark}
                        strokeOpacity="0.4"
                        strokeWidth={isMobile ? "0.5" : "0.8"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    {/* 2. Animated Foreground Track (Gold) */}
                    <motion.path
                        d={currentPath}
                        fill="none"
                        stroke={COLORS.gold}
                        strokeWidth={isMobile ? "1" : "1.5"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        filter="drop-shadow(0px 0px 4px rgba(214,134,20, 0.6))"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: isInView ? 10 : 0 }}
                        transition={{ duration: ANIMATION_DURATION, ease: "linear" }}
                    />
                </svg>
            </div>

            {/* Nodes Layer */}
            <div className="relative z-20 w-full h-full pointer-events-none">
                {currentNodes.map((node) => (
                    <CircuitNode
                        key={node.id}
                        data={node}
                        startAnimation={isInView}
                        isFinale={node.id === 'impact'}
                        isMobile={isMobile}
                    />
                ))}
            </div>

            {/* Finale Bloom */}
            <motion.div
                className="absolute bottom-0 left-0 w-full h-[30vh] pointer-events-none z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: isInView ? 1 : 0 }}
                transition={{ delay: ANIMATION_DURATION * 0.9, duration: 1 }}
                style={{
                    background: `radial-gradient(circle at center bottom, rgba(214,134,20, 0.07) 0%, transparent 70%)`
                }}
            />
        </div>
    );
};