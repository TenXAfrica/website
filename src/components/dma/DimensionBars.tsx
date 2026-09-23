import React from 'react';
import type { DimensionScore } from '../../../shared/dma/types';
import { usePrefersReducedMotion, useMounted } from './util';

interface DimensionBarsProps {
  dimensions: DimensionScore[];
}

/**
 * Label, number, hairline track. The numbers are real text, so the bars
 * themselves are decorative and hidden from assistive technology.
 */
export const DimensionBars: React.FC<DimensionBarsProps> = ({ dimensions }) => {
  const reduced = usePrefersReducedMotion();
  const mounted = useMounted(120);
  const grown = mounted || reduced;

  return (
    <ul className="m-0 list-none space-y-6 p-0">
      {dimensions.map((dimension, index) => (
        <li key={dimension.dimension}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-heading text-[0.95rem] leading-snug font-semibold text-vapor-white sm:text-base">
              {dimension.label}
            </span>
            <span className="shrink-0 font-heading text-sm font-semibold tabular-nums text-text-muted">
              {dimension.score}
              <span className="text-text-faint">/100</span>
            </span>
          </div>
          <div
            className="dma-bar-track mt-2.5 h-[3px] w-full overflow-hidden bg-rule"
            aria-hidden="true"
          >
            <div
              className="dma-bar-fill h-full bg-tenx-gold"
              style={{
                width: grown ? `${dimension.score}%` : '0%',
                transition: reduced
                  ? undefined
                  : `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
