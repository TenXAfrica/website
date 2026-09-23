/**
 * Jump between the six dimensions and see at a glance which are done.
 * Rendered twice: a sticky rail on desktop, a scrolling bar on narrow screens.
 * Selection is a callback, not an anchor, because the interview shows one
 * dimension at a time.
 */

import type { DimensionId } from '../../../../shared/dma/types';

export interface DimensionProgress {
  dimension: DimensionId;
  label: string;
  complete: number;
  total: number;
  /** Questions with a narrative but no maturity call yet. */
  unscored: number;
}

export const dimensionSectionId = (id: DimensionId) => `dim-${id}`;

function state(p: DimensionProgress): 'done' | 'partial' | 'empty' {
  if (p.complete >= p.total) return 'done';
  if (p.complete > 0 || p.unscored > 0) return 'partial';
  return 'empty';
}

const DOT: Record<'done' | 'partial' | 'empty', string> = {
  done: 'bg-tenx-gold',
  partial: 'bg-gold-hover/60',
  empty: 'bg-border-interactive',
};

interface NavProps {
  progress: DimensionProgress[];
  activeId: DimensionId | null;
  onSelect: (id: DimensionId) => void;
}

export function DimensionSidebar({ progress, activeId, onSelect }: NavProps) {
  return (
    <nav aria-label="Dimensions">
      <h2 className="mb-2 text-[0.75rem] tracking-[0.14em] text-text-faint uppercase">
        Dimensions
      </h2>
      <ol className="space-y-0.5">
        {progress.map((p, i) => {
          const s = state(p);
          const active = activeId === p.dimension;
          return (
            <li key={p.dimension}>
              <button
                type="button"
                onClick={() => onSelect(p.dimension)}
                aria-current={active ? 'step' : undefined}
                className={
                  'flex w-full items-center gap-2 rounded-[2px] px-2 py-2 text-left text-[0.8125rem] leading-snug transition-colors duration-150 ' +
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold ' +
                  (active
                    ? 'bg-surface-2 text-vapor-white'
                    : 'text-text-muted hover:bg-surface-1 hover:text-vapor-white')
                }
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s]}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="mr-1.5 tabular-nums text-text-faint">{i + 1}</span>
                  {p.label}
                </span>
                <span className="shrink-0 text-[0.75rem] tabular-nums text-text-faint">
                  {p.complete}/{p.total}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DimensionBar({ progress, activeId, onSelect }: NavProps) {
  return (
    <nav
      aria-label="Dimensions"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-2"
    >
      {progress.map((p, i) => {
        const s = state(p);
        const active = activeId === p.dimension;
        return (
          <button
            key={p.dimension}
            type="button"
            onClick={() => onSelect(p.dimension)}
            aria-current={active ? 'step' : undefined}
            className={
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[0.8125rem] whitespace-nowrap ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold ' +
              (active
                ? 'border-tenx-gold bg-surface-2 text-vapor-white'
                : 'border-rule text-text-muted')
            }
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s]}`}
            />
            {i + 1}. {p.label}
            <span className="tabular-nums text-text-faint">
              {p.complete}/{p.total}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
