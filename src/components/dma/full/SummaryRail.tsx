/**
 * The live rail. This is what Joash reads back to the client in the last five
 * minutes of the call, so it recomputes as he types (debounced upstream) and
 * never hides behind a "calculate" button.
 */

import { WORKING_WEEKS } from '../../../../shared/dma/scoring';
import type { ScoreResult } from '../../../../shared/dma/types';
import { MATURITY_ANCHORS, PAIN_ANCHORS, TOTAL_QUESTIONS } from './report';

export interface SummaryRailProps {
  result: ScoreResult | null;
  completed: number;
  scored: number;
  totalHours: number;
  hourlyRateUsd: number;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-rule bg-surface-1 px-2.5 py-2">
      <div className="text-xs tracking-wider text-text-faint uppercase">
        {label}
      </div>
      <div className="font-heading text-lg leading-tight font-semibold tabular-nums text-vapor-white">
        {value}
      </div>
      {sub && <div className="text-xs leading-tight text-text-faint">{sub}</div>}
    </div>
  );
}

export function SummaryRail({
  result,
  completed,
  scored,
  totalHours,
  hourlyRateUsd,
}: SummaryRailProps) {
  const annualHours = Math.round(totalHours * WORKING_WEEKS);
  const annualValue = annualHours * hourlyRateUsd;

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border border-tenx-gold/25 bg-surface-1 p-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="text-xs tracking-wider text-text-faint uppercase">
          Overall maturity
        </div>
        {result && scored > 0 ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl leading-none font-bold tabular-nums text-tenx-gold">
                {result.overall}
              </span>
              <span className="text-sm text-text-faint">/ 100</span>
            </div>
            <div className="mt-1 font-heading text-sm font-semibold text-vapor-white">
              {result.band.label}
            </div>
            <p className="mt-1 text-xs leading-snug text-text-faint">
              {result.band.meaning}
            </p>
            <div className="mt-2 text-xs text-text-faint">
              Provisional fit {result.fitScore.replace('RATING_', '')}/5
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs leading-snug text-text-faint">
            Set a maturity value on any question and the score appears here.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Complete"
          value={`${completed}/${TOTAL_QUESTIONS}`}
          sub={scored !== completed ? `${scored} scored` : undefined}
        />
        <Stat
          label="Hours / week"
          value={totalHours > 0 ? num(totalHours) : '—'}
          sub={
            totalHours > 0
              ? `${annualHours.toLocaleString('en-US')} h/yr · ${usd(annualValue)}`
              : undefined
          }
        />
      </div>

      {result && result.dimensions.length > 0 && (
        <div className="rounded-lg border border-rule bg-surface-1 p-3">
          <div className="mb-2 text-xs tracking-wider text-text-faint uppercase">
            By dimension
          </div>
          <ul className="space-y-1.5">
            {result.dimensions.map((d) => (
              <li key={d.dimension}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-text-muted">{d.label}</span>
                  <span className="shrink-0 tabular-nums text-text-faint">
                    {d.score}
                  </span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-rule">
                  <div
                    className="h-1 rounded-full bg-tenx-gold/70"
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.recommendations.length > 0 && (
        <div className="rounded-lg border border-rule bg-surface-1 p-3">
          <div className="mb-2 text-xs tracking-wider text-text-faint uppercase">
            Top recommendations
          </div>
          <ol className="space-y-2.5">
            {result.recommendations.map((rec, i) => (
              <li key={rec.buildType}>
                <div className="font-heading text-xs leading-snug font-semibold text-vapor-white">
                  {i + 1}. {rec.label}
                </div>
                <div className="text-xs text-text-faint">
                  {rec.priceBand.tier} · {usd(rec.priceBand.low)}–
                  {usd(rec.priceBand.high)}
                </div>
                {rec.roi && (
                  <div className="text-xs text-tenx-gold/80">
                    ~{num(rec.roi.hoursPerWeekRecovered)} h/week back ·{' '}
                    {usd(rec.roi.annualValueUsd)}/yr
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <details className="rounded-lg border border-rule bg-surface-1 p-3">
        <summary className="cursor-pointer text-xs tracking-wider text-text-faint uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tenx-gold">
          Scale legend
        </summary>
        <dl className="mt-2 space-y-1 text-xs">
          <dt className="text-text-muted">Maturity</dt>
          {MATURITY_ANCHORS.map((m) => (
            <dd key={m.value} className="flex gap-2 text-text-faint">
              <span className="w-3 shrink-0 tabular-nums text-tenx-gold/70">
                {m.value}
              </span>
              <span>{m.label}</span>
            </dd>
          ))}
          <dt className="mt-2 text-text-muted">Pain</dt>
          {PAIN_ANCHORS.map((p) => (
            <dd key={p.value} className="flex gap-2 text-text-faint">
              <span className="w-3 shrink-0 tabular-nums text-tenx-gold/70">
                {p.value}
              </span>
              <span>{p.label}</span>
            </dd>
          ))}
        </dl>
      </details>
    </div>
  );
}

export default SummaryRail;
