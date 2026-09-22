/**
 * Jump between the six dimensions and see at a glance which are done.
 * Rendered twice: a sticky rail on desktop, a sticky scrolling bar below it.
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
  partial: 'bg-amber-400/60',
  empty: 'bg-white/15',
};

export function DimensionSidebar({
  progress,
  activeId,
}: {
  progress: DimensionProgress[];
  activeId: DimensionId | null;
}) {
  return (
    <nav aria-label="Dimensions">
      <h2 className="mb-2 text-[10px] tracking-wider text-white/35 uppercase">
        Dimensions
      </h2>
      <ol className="space-y-0.5">
        {progress.map((p) => {
          const s = state(p);
          const active = activeId === p.dimension;
          return (
            <li key={p.dimension}>
              <a
                href={`#${dimensionSectionId(p.dimension)}`}
                aria-current={active ? 'true' : undefined}
                className={
                  'flex items-center gap-2 rounded px-2 py-1.5 text-xs leading-snug transition-colors duration-100 ' +
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold ' +
                  (active
                    ? 'bg-tenx-gold/10 text-vapor-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white/85')
                }
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s]}`}
                />
                <span className="min-w-0 flex-1">{p.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                  {p.complete}/{p.total}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DimensionBar({
  progress,
  activeId,
}: {
  progress: DimensionProgress[];
  activeId: DimensionId | null;
}) {
  return (
    <nav
      aria-label="Dimensions"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-2"
    >
      {progress.map((p) => {
        const s = state(p);
        const active = activeId === p.dimension;
        return (
          <a
            key={p.dimension}
            href={`#${dimensionSectionId(p.dimension)}`}
            aria-current={active ? 'true' : undefined}
            className={
              'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] whitespace-nowrap ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold ' +
              (active
                ? 'border-tenx-gold/60 bg-tenx-gold/10 text-vapor-white'
                : 'border-white/12 text-white/55')
            }
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s]}`}
            />
            {p.label}
            <span className="tabular-nums text-white/35">
              {p.complete}/{p.total}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
