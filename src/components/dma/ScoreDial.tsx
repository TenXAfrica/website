import React from 'react';
import { usePrefersReducedMotion, useMounted } from './util';

interface ScoreDialProps {
  score: number;
}

const SIZE = 220;
const RADIUS = 94;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Three quarters of a circle, opening at the bottom. */
const SWEEP = CIRCUMFERENCE * 0.75;

/**
 * A single thin arc. No glow, no gradient — the number carries the weight
 * and the arc is only there to give it a shape you can read at a glance.
 * The band label lives in the heading beside it, so it is not repeated here.
 */
export const ScoreDial: React.FC<ScoreDialProps> = ({ score }) => {
  const reduced = usePrefersReducedMotion();
  const mounted = useMounted();
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const filled = mounted || reduced ? SWEEP * (safe / 100) : 0;

  return (
    <div className="relative mx-auto w-[196px] max-w-full sm:w-[224px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="dma-dial block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            className="dma-dial-track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(244,244,249,0.13)"
            strokeWidth="7"
            strokeDasharray={`${SWEEP} ${CIRCUMFERENCE}`}
          />
          <circle
            className="dma-dial-value"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#d68614"
            strokeWidth="7"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            style={
              reduced
                ? undefined
                : {
                    transition:
                      'stroke-dasharray 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }
            }
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-heading text-[3.25rem] leading-none font-bold tracking-tight tabular-nums text-vapor-white sm:text-[3.75rem]">
          {safe}
        </p>
        <p className="mt-2 font-sans text-xs tracking-[0.2em] uppercase text-text-muted">
          out of 100
        </p>
      </div>
    </div>
  );
};
