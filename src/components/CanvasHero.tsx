import React, { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
// Ensure you point to the correct path of your SVG
import africaSvgRaw from '../assets/OutlineMap-Africa.svg?raw';

interface CanvasHeroProps {
    variant?: 'shape' | 'chaos';
    className?: string;
}

export const CanvasHero: React.FC<CanvasHeroProps> = ({ variant = 'chaos', className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const normalizedPointsRef = useRef<{ x: number; y: number }[]>([]);

    // Track previous dimensions to prevent address bar resize glitches
    const prevWidthRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let w: number;
        let h: number;

        // --- MOBILE OPTIMIZATION CONFIG ---
        // We detect mobile by width (standard breakpoint)
        // You can adjust 768 to whatever your mobile breakpoint is
        const isMobile = window.innerWidth < 768;

        // drastically reduce count on mobile to save battery and FPS
        const particleCount = variant === 'shape' ? (isMobile ? 120 : 400) : (isMobile ? 60 : 150);

        // shorter connection distance on mobile prevents messy webs and saves calculations
        const connectionDistance = variant === 'shape' ? (isMobile ? 60 : 80) : 120;

        const mouseDistance = isMobile ? 150 : 200;

        interface Point {
            x: number;
            y: number;
            vx: number;
            vy: number;
            targetX?: number;
            targetY?: number;
        }

        let particles: Point[] = [];
        const mouse = { x: -9999, y: -9999 }; // Initialize off-screen

        const processSVG = () => {
            if (normalizedPointsRef.current.length > 0) return;

            const parser = new DOMParser();
            const doc = parser.parseFromString(africaSvgRaw, 'image/svg+xml');
            const path = doc.querySelector('path');

            if (!path) return;

            const totalLength = path.getTotalLength();
            const points: { x: number; y: number }[] = [];

            for (let i = 0; i < particleCount; i++) {
                const len = (i / particleCount) * totalLength;
                const pt = path.getPointAtLength(len);
                points.push({ x: pt.x, y: pt.y });
            }

            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const rangeX = maxX - minX;
            const rangeY = maxY - minY;
            const maxRange = Math.max(rangeX, rangeY);

            normalizedPointsRef.current = points.map(p => ({
                x: (p.x - minX) / maxRange,
                y: 1.0 - ((p.y - minY) / maxRange)
            }));
        };

        const resize = () => {
            const parent = canvas.offsetParent as HTMLElement;
            let newW, newH;

            if (parent && variant === 'chaos') {
                newW = parent.clientWidth;
                newH = parent.clientHeight;
            } else {
                newW = window.innerWidth;
                newH = window.innerHeight;
            }

            // --- CRITICAL MOBILE FIX ---
            // On mobile, scrolling hides/shows the address bar, changing the Height.
            // This triggers a resize, restarting the animation constantly.
            // We ONLY restart if the WIDTH changes (actual rotation or window resize).
            if (Math.abs(newW - prevWidthRef.current) < 50 && prevWidthRef.current !== 0) {
                // Just update height variable, don't re-init particles
                h = canvas.height = newH;
                return;
            }

            prevWidthRef.current = newW;
            w = canvas.width = newW;
            h = canvas.height = newH;

            initParticles();
        };

        const initParticles = () => {
            processSVG();
            particles = [];

            const scale = Math.min(w, h) * (isMobile ? 0.9 : 0.8);
            const offsetX = (w - scale) / 2;
            const offsetY = (h - scale) / 2;

            for (let i = 0; i < particleCount; i++) {
                const normalizedTarget = normalizedPointsRef.current[i % normalizedPointsRef.current.length] || { x: 0.5, y: 0.5 };

                const targetX = offsetX + (normalizedTarget.x * scale);
                const targetY = offsetY + (normalizedTarget.y * scale);

                const speedFactor = variant === 'chaos' ? 2.0 : 0.5;

                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * speedFactor,
                    vy: (Math.random() - 0.5) * speedFactor,
                    targetX: variant === 'shape' ? targetX : undefined,
                    targetY: variant === 'shape' ? targetY : undefined
                });
            }
        };

        const draw = () => {
            // Optimization: Use clearRect instead of filling with transparent rect if possible, 
            // but for transparency handling clearRect is safer.
            ctx.clearRect(0, 0, w, h);

            ctx.fillStyle = '#d68614';
            ctx.strokeStyle = 'rgba(214, 134, 20, 0.2)';

            const time = Date.now() * 0.001;

            // Calculate drift once per frame for shape variant optimization
            const driftBase = Math.sin(time);

            particles.forEach((p, i) => {
                if (variant === 'shape' && p.targetX !== undefined && p.targetY !== undefined) {
                    // Simplified drift math for performance
                    const driftRange = isMobile ? 10 : 15;
                    const driftX = Math.sin(time + i * 0.1) * driftRange;
                    const driftY = Math.cos(time + i * 0.1) * driftRange;

                    const dx = (p.targetX + driftX) - p.x;
                    const dy = (p.targetY + driftY) - p.y;

                    p.vx += dx * 0.001;
                    p.vy += dy * 0.001;
                }

                if (variant === 'chaos') {
                    const wanderStrength = 0.02;
                    p.vx += Math.sin(time + p.y * 0.01 + i) * wanderStrength;
                    p.vy += Math.cos(time + p.x * 0.01 + i) * wanderStrength;
                }

                const friction = variant === 'chaos' ? 0.99 : 0.95;
                p.vx *= friction;
                p.vy *= friction;

                p.x += p.vx;
                p.y += p.vy;

                if (variant === 'chaos') {
                    if (p.x < 0) { p.x = 0; p.vx *= -1; }
                    if (p.x > w) { p.x = w; p.vx *= -1; }
                    if (p.y < 0) { p.y = 0; p.vy *= -1; }
                    if (p.y > h) { p.y = h; p.vy *= -1; }
                }

                // Mouse interaction - Only run if mouse is on screen
                if (mouse.x > -100 && mouse.y > -100) {
                    const dxMouse = mouse.x - p.x;
                    const dyMouse = mouse.y - p.y;
                    // Optimization: Simple box check before expensive Math.sqrt
                    if (Math.abs(dxMouse) < mouseDistance && Math.abs(dyMouse) < mouseDistance) {
                        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
                        if (distMouse < mouseDistance) {
                            const angle = Math.atan2(dyMouse, dxMouse);
                            const force = (mouseDistance - distMouse) / mouseDistance;
                            const pushStrength = variant === 'chaos' ? 0.08 : 0.06;
                            p.vx -= Math.cos(angle) * force * pushStrength;
                            p.vy -= Math.sin(angle) * force * pushStrength;
                        }
                    }
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, isMobile ? 1.5 : 2, 0, Math.PI * 2);
                ctx.fill();

                // Connections Loop
                // Optimization: Don't connect everything on mobile, or reduce distance
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx2 = p.x - p2.x;
                    const dy2 = p.y - p2.y;

                    // Super fast check to skip far away particles
                    if (Math.abs(dx2) > connectionDistance || Math.abs(dy2) > connectionDistance) continue;

                    const dist2Sq = dx2 * dx2 + dy2 * dy2;
                    if (dist2Sq < connectionDistance * connectionDistance) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        // Avoid expensive sqrt for alpha if possible, but needed for visual
                        ctx.globalAlpha = 1 - Math.sqrt(dist2Sq) / connectionDistance;
                        ctx.stroke();
                        ctx.globalAlpha = 1.0;
                    }
                }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            }
        };

        // Add touch support for mobile interaction
        const onTouchMove = (e: TouchEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect && e.touches[0]) {
                mouse.x = e.touches[0].clientX - rect.left;
                mouse.y = e.touches[0].clientY - rect.top;
            }
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove);

        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, [variant]);

    return (
        <canvas
            ref={canvasRef}
            className={twMerge("pointer-events-none opacity-40", className)}
        />
    );
};