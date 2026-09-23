/**
 * The home hero's signature animation: gold nodes drift in from random
 * positions and settle into the outline of Africa, joined by faint lines to
 * their neighbours. The cursor (or a finger) pushes nearby nodes aside and
 * they drift back.
 *
 * Rules:
 *  - Zero work until it is on screen; it pauses when scrolled away or the
 *    tab is hidden, so it never costs battery in the background.
 *  - Under prefers-reduced-motion it draws the settled shape once and stops.
 *  - Points are precomputed (africa-points.json) so no SVG is parsed here.
 *  - Device pixel ratio is capped at 2 and the node count scales with size.
 */

import { useEffect, useRef } from 'react';
import POINTS from './africa-points.json';

type Pt = [number, number];
const OUTLINE = POINTS as Pt[];

const GOLD = '214, 134, 20';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  /** Phase for the idle drift so nodes do not all breathe together. */
  phase: number;
}

interface Props {
  className?: string;
}

export function AfricaConstellation({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let nodes: Node[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let visible = false;
    let startedAt = 0;
    let connectDist = 60;
    const pointer = { x: -9999, y: -9999, active: false };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w === width && h === height && nodes.length > 0) return;
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const size = Math.min(w, h) * 0.86;
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const small = w < 640;
      const count = small ? Math.min(OUTLINE.length, 260) : OUTLINE.length;
      const stride = OUTLINE.length / count;
      connectDist = size * (small ? 0.075 : 0.06);

      const keepVelocity = nodes.length === count;
      const next: Node[] = [];
      for (let i = 0; i < count; i++) {
        const p = OUTLINE[Math.floor(i * stride) % OUTLINE.length];
        const tx = ox + p[0] * size;
        const ty = oy + p[1] * size;
        const prev = keepVelocity ? nodes[i] : undefined;
        next.push(
          prev
            ? { ...prev, tx, ty }
            : {
                x: reduce ? tx : Math.random() * w,
                y: reduce ? ty : Math.random() * h,
                vx: 0,
                vy: 0,
                tx,
                ty,
                phase: Math.random() * Math.PI * 2,
              }
        );
      }
      nodes = next;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = now * 0.001;
      // The whole scene fades in over the first 1.4 seconds.
      const fade = reduce ? 1 : Math.min(1, (now - startedAt) / 1400);
      const drift = reduce ? 0 : Math.min(width, height) * 0.012;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reduce) {
          const gx = n.tx + Math.sin(t * 0.6 + n.phase) * drift;
          const gy = n.ty + Math.cos(t * 0.5 + n.phase) * drift;
          n.vx += (gx - n.x) * 0.012;
          n.vy += (gy - n.y) * 0.012;

          if (pointer.active) {
            const dx = n.x - pointer.x;
            const dy = n.y - pointer.y;
            const r = connectDist * 2.2;
            if (Math.abs(dx) < r && Math.abs(dy) < r) {
              const d = Math.hypot(dx, dy) || 1;
              if (d < r) {
                const f = ((r - d) / r) * 0.9;
                n.vx += (dx / d) * f;
                n.vy += (dy / d) * f;
              }
            }
          }

          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      // Lines first, then dots on top.
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.abs(dx) > connectDist || Math.abs(dy) > connectDist) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > connectDist * connectDist) continue;
          const alpha = (1 - Math.sqrt(d2) / connectDist) * 0.35 * fade;
          ctx.strokeStyle = `rgba(${GOLD}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${GOLD}, ${(0.9 * fade).toFixed(3)})`;
      const r = width < 640 ? 1.2 : 1.6;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!running) return;
      draw(now);
      if (!reduce) raf = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      layout();
      if (startedAt === 0) startedAt = performance.now();
      if (raf === 0) raf = window.requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const sync = () => {
      if (visible && document.visibilityState !== 'hidden') start();
      else stop();
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    const onVisibility = () => sync();
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      layout();
      if (reduce && running) draw(performance.now());
    });
    ro.observe(canvas);

    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = clientX - rect.left;
      pointer.y = clientY - rect.top;
      pointer.active = true;
    };
    const onMove = (e: PointerEvent) => toLocal(e.clientX, e.clientY);
    const onLeave = () => {
      pointer.active = false;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) toLocal(t.clientX, t.clientY);
    };
    // Listen on the window so the effect also works when the canvas sits
    // behind the hero text on small screens.
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onLeave);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Gold points drifting together to form the outline of Africa."
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}

export default AfricaConstellation;
