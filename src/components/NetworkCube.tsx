import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useAnimationFrame } from 'framer-motion';

export const NetworkCube: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isInView, setIsInView] = useState(false);

  // Motion values for the rotation degrees
  const rotateX = useMotionValue(-15); // Start with a slight tilt
  const rotateY = useMotionValue(15);

  // Smooth out the rotation values so it doesn't snap harshly
  const smoothRotateX = useSpring(rotateX, { damping: 20, stiffness: 150 });
  const smoothRotateY = useSpring(rotateY, { damping: 20, stiffness: 150 });

  // Previous mouse position for calculating delta
  const prevMouse = useRef({ x: 0, y: 0 });

  // Intersection Observer to detect visibility
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. AUTO-ROTATION LOOP (only runs when component is in view)
  useAnimationFrame((t, delta) => {
    if (!isDragging && isInView) {
      // Spin 15 degrees per second on Y axis
      // Adjust the 0.02 multiplier to change speed
      const currentY = rotateY.get();
      rotateY.set(currentY + 0.02 * delta);
    }
  });

  // 2. DRAG HANDLERS
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    prevMouse.current = { x: e.clientX, y: e.clientY };
    // Capture pointer so you can drag outside the div
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - prevMouse.current.x;
    const deltaY = e.clientY - prevMouse.current.y;

    prevMouse.current = { x: e.clientX, y: e.clientY };

    // Invert Y delta because dragging down should rotate X down (positive)
    // Adjust sensitivity by multiplying delta (e.g., * 0.5)
    rotateY.set(rotateY.get() + deltaX * 0.5);
    rotateX.set(rotateX.get() - deltaY * 0.5);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] flex items-center justify-center perspective-1000 touch-none"
    >
      <style>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .face {
                    position: absolute;
                    width: 200px;
                    height: 200px;
                    border: 2px solid rgba(214, 134, 20, 0.5);
                    background: rgba(10, 15, 20, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backface-visibility: visible;
                    user-select: none; /* Prevent text highlighting while dragging */
                }
                .front  { transform: rotateY(0deg) translateZ(100px); }
                .back   { transform: rotateY(180deg) translateZ(100px); }
                .right  { transform: rotateY(90deg) translateZ(100px); }
                .left   { transform: rotateY(-90deg) translateZ(100px); }
                .top    { transform: rotateX(90deg) translateZ(100px); }
                .bottom { transform: rotateX(-90deg) translateZ(100px); }
            `}</style>

      <motion.div
        className="relative w-[200px] h-[200px] cursor-grab active:cursor-grabbing"
        style={{
          transformStyle: "preserve-3d",
          rotateX: smoothRotateX,
          rotateY: smoothRotateY,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // Safety release
      >
        <div className="face front text-tenx-gold font-mono text-2xl font-bold tracking-widest">NETWORK</div>
        <div className="face back text-tenx-gold font-mono text-2xl font-bold tracking-widest">DATA</div>
        <div className="face right text-tenx-gold font-mono text-2xl font-bold tracking-widest">CAPITAL</div>
        <div className="face left text-tenx-gold font-mono text-2xl font-bold tracking-widest">SCALE</div>
        <div className="face top text-tenx-gold font-mono text-xl font-bold tracking-widest">GROWTH</div>
        <div className="face bottom text-tenx-gold font-mono text-xl font-bold tracking-widest">POWER</div>
      </motion.div>
    </div>
  );
};