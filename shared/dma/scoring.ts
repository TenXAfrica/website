import {
  BUILD_META,
  DIMENSION_META,
  FULL_DMA_QUESTIONS,
  MATURITY_BANDS,
  SELF_SERVE_QUESTIONS,
} from './questions';
import { BUILD_TYPES } from './types';
import type {
  AnswerOption,
  BuildRecommendation,
  BuildTypeId,
  BuildWeights,
  CompanySignal,
  DimensionId,
  DimensionScore,
  FullSubmission,
  MaturityBand,
  Question,
  ScoreResult,
  SelfServeContact,
} from './types';

/** Working weeks a year. Four weeks off, conservative on purpose. */
export const WORKING_WEEKS = 48;

/** Used when nobody has told us what an hour costs them. */
export const DEFAULT_HOURLY_RATE_USD = 25;

const BUILD_BY_ID = new Map(BUILD_META.map((b) => [b.id, b]));
const DIMENSION_BY_ID = new Map(DIMENSION_META.map((d) => [d.id, d]));

/** The last band is the fallback, and MATURITY_BANDS is never empty. */
const HIGHEST_BAND: MaturityBand = MATURITY_BANDS[MATURITY_BANDS.length - 1]!;

export function bandFor(score: number): MaturityBand {
  return (
    MATURITY_BANDS.find((b) => score >= b.min && score <= b.max) ?? HIGHEST_BAND
  );
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ------------------------------------------------------------------ */
/* Shared core                                                         */
/* ------------------------------------------------------------------ */

interface ScoredItem {
  dimension: DimensionId;
  /** 0-4 */
  score: number;
  builds: BuildWeights;
  signals: CompanySignal[];
  hoursPerWeek?: number;
}

function rollUp(
  items: ScoredItem[],
  opts: {
    topN: number;
    hourlyRateUsd?: number;
    companySize?: SelfServeContact['size'];
    country?: string;
    /** Hours only get a value attached when we were told the rate. */
    totalHoursPerWeek?: number;
  }
): ScoreResult {
  /* --- per-dimension --- */
  const dimensions: DimensionScore[] = DIMENSION_META.map((meta) => {
    const own = items.filter((i) => i.dimension === meta.id);
    const earned = own.reduce((sum, i) => sum + i.score, 0);
    const available = own.length * 4;
    const pct = available === 0 ? 0 : clampPercent((earned / available) * 100);
    return {
      dimension: meta.id,
      label: meta.label,
      score: pct,
      raw: { earned, available },
      band: bandFor(pct).id,
    };
  }).filter((d) => d.raw.available > 0);

  /* --- overall, weighted --- */
  const totalWeight = dimensions.reduce(
    (sum, d) => sum + (DIMENSION_BY_ID.get(d.dimension)?.weight ?? 0),
    0
  );
  const overall = clampPercent(
    dimensions.reduce(
      (sum, d) => sum + d.score * (DIMENSION_BY_ID.get(d.dimension)?.weight ?? 0),
      0
    ) / (totalWeight || 1)
  );

  /* --- build signal accumulation --- */
  const weights = new Map<BuildTypeId, number>();
  const drivers = new Map<BuildTypeId, Set<DimensionId>>();
  for (const item of items) {
    for (const [buildId, w] of Object.entries(item.builds) as [
      BuildTypeId,
      number
    ][]) {
      if (!w) continue;
      weights.set(buildId, (weights.get(buildId) ?? 0) + w);
      if (!drivers.has(buildId)) drivers.set(buildId, new Set());
      drivers.get(buildId)!.add(item.dimension);
    }
  }

  // Ties are common — a fully manual business often signals two builds at
  // exactly the same weight. Break them on catalogue order rather than on
  // whichever answer happened to be seen first, so the same answers always
  // produce the same two recommendations.
  const ranked = [...weights.entries()]
    .filter(([, w]) => w > 0)
    .sort(
      (a, b) =>
        b[1] - a[1] || BUILD_TYPES.indexOf(a[0]) - BUILD_TYPES.indexOf(b[0])
    )
    .slice(0, opts.topN);

  const maxWeight = ranked[0]?.[1] ?? 1;
  const rankedTotal = ranked.reduce((sum, [, w]) => sum + w, 0) || 1;

  const recommendations: BuildRecommendation[] = ranked.map(([buildId, w]) => {
    const meta = BUILD_BY_ID.get(buildId)!;
    const rec: BuildRecommendation = {
      buildType: buildId,
      label: meta.label,
      summary: meta.summary,
      strength: clampPercent((w / maxWeight) * 100),
      drivers: [...(drivers.get(buildId) ?? [])],
      priceBand: priceBandFor(meta.size, opts.companySize),
    };

    if (opts.totalHoursPerWeek && opts.totalHoursPerWeek > 0) {
      // Split the measured hours across the recommended builds in
      // proportion to how strongly each was signalled, then only claim
      // the share that build type actually automates.
      const share = (w / rankedTotal) * opts.totalHoursPerWeek;
      const recovered = round1(share * meta.automationFactor);
      const annualHours = Math.round(recovered * WORKING_WEEKS);
      rec.roi = {
        hoursPerWeekRecovered: recovered,
        annualHoursRecovered: annualHours,
        annualValueUsd: Math.round(
          annualHours * (opts.hourlyRateUsd ?? DEFAULT_HOURLY_RATE_USD)
        ),
      };
    }

    return rec;
  });

  // When hours are known, present the recommendations in order of hours
  // recovered: a panel headed "start with these two" should lead with the
  // bigger win. The top-N cut above still goes by signal strength, so a
  // weakly signalled build never gets in just because its automation
  // factor is high; this only reorders what already made the cut.
  if (recommendations.length > 1 && recommendations.every((r) => r.roi)) {
    recommendations.sort(
      (a, b) =>
        b.roi!.hoursPerWeekRecovered - a.roi!.hoursPerWeekRecovered ||
        b.strength - a.strength ||
        BUILD_TYPES.indexOf(a.buildType) - BUILD_TYPES.indexOf(b.buildType)
    );
  }

  /* --- CRM signals --- */
  const signals = [...new Set(items.flatMap((i) => i.signals))];

  return {
    overall,
    band: bandFor(overall),
    dimensions,
    recommendations,
    signals,
    fitScore: fitScoreFor(overall, opts.companySize, opts.country),
    estimatedHoursPerWeek: opts.totalHoursPerWeek,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Price band                                                          */
/* ------------------------------------------------------------------ */

/**
 * Catalogue size maps to the approved USD tiers. A bigger company lands at
 * the top of its band, never in a higher one: the tailored price comes out
 * of the DMA call, not out of this function.
 */
export function priceBandFor(
  size: 'small' | 'medium',
  companySize?: SelfServeContact['size']
): BuildRecommendation['priceBand'] {
  const big = companySize === 'S_51_200' || companySize === 'S_200_PLUS';
  if (size === 'small' && !big) {
    return { low: 2500, high: 4500, tier: 'Launch' };
  }
  if (big && size === 'medium') {
    return { low: 15000, high: 28000, tier: 'Scale' };
  }
  return { low: 6500, high: 12000, tier: 'Growth' };
}

/* ------------------------------------------------------------------ */
/* Fit score                                                           */
/* ------------------------------------------------------------------ */

/** Countries we sell into first. Drives the fit bump, not eligibility. */
const TIER_1 = new Set(['US', 'GB', 'UK', 'IE', 'AU', 'NZ', 'AE']);

/**
 * Fit is "evidence of pain, ability to pay, fit to what we sell".
 * Low maturity is a good thing here: it means there is something to fix.
 */
export function fitScoreFor(
  overall: number,
  companySize?: SelfServeContact['size'],
  country?: string
): ScoreResult['fitScore'] {
  let points = 0;

  // Pain: the lower the maturity, the more there is to win.
  if (overall < 25) points += 2;
  else if (overall < 45) points += 2;
  else if (overall < 65) points += 1;
  else if (overall < 85) points += 0;
  else points -= 1;

  // Ability to pay, and whether they are our size of business.
  switch (companySize) {
    case 'S_1_5':
      points -= 1;
      break;
    case 'S_6_20':
      points += 2;
      break;
    case 'S_21_50':
      points += 2;
      break;
    case 'S_51_200':
      points += 1;
      break;
    case 'S_200_PLUS':
      points -= 1;
      break;
    default:
      break;
  }

  // Market we are selling into first.
  const cc = (country ?? '').trim().toUpperCase();
  if (TIER_1.has(cc)) points += 1;

  const rating = Math.max(1, Math.min(5, 1 + points));
  return `RATING_${rating}` as ScoreResult['fitScore'];
}

/* ------------------------------------------------------------------ */
/* Self-serve                                                          */
/* ------------------------------------------------------------------ */

export function scoreSelfServe(
  answers: Record<string, string>,
  contact?: Partial<SelfServeContact>
): ScoreResult {
  const items: ScoredItem[] = [];
  let totalHours = 0;

  for (const q of SELF_SERVE_QUESTIONS) {
    const chosen = answers[q.id];
    const option = q.options.find((o) => o.value === chosen);
    if (!option) continue;
    items.push(toScoredItem(q, option));
    if (typeof option.hoursPerWeek === 'number') {
      totalHours += option.hoursPerWeek;
    }
  }

  return rollUp(items, {
    topN: 2,
    companySize: contact?.size,
    country: contact?.country,
    totalHoursPerWeek: totalHours || undefined,
  });
}

function toScoredItem(q: Question, option: AnswerOption): ScoredItem {
  return {
    dimension: q.dimension,
    score: option.score,
    builds: option.builds ?? {},
    signals: option.signals ?? [],
    hoursPerWeek: option.hoursPerWeek,
  };
}

/** Every self-serve question must be answered before we score anything. */
export function selfServeIsComplete(answers: Record<string, string>): boolean {
  return SELF_SERVE_QUESTIONS.every((q) =>
    q.options.some((o) => o.value === answers[q.id])
  );
}

/* ------------------------------------------------------------------ */
/* Full DMA                                                            */
/* ------------------------------------------------------------------ */

/**
 * In the guided DMA the interviewer sets maturity directly and records
 * hours and pain. Build signals come from pain-weighted hours per
 * dimension rather than from a fixed option map, because the questions are
 * open-ended.
 */
const DIMENSION_BUILD_AFFINITY: Record<DimensionId, BuildWeights> = {
  sales: { inbox_triage: 2, doc_generation: 2, quote_to_invoice: 1 },
  operations: { ops_dashboard: 3, intake_portal: 1 },
  finance: { quote_to_invoice: 3, doc_generation: 1 },
  people: { intake_portal: 3, inbox_triage: 1 },
  data: { ops_dashboard: 2, intake_portal: 1, quote_to_invoice: 1 },
  ai: { doc_generation: 1 },
};

export function scoreFull(submission: FullSubmission): ScoreResult {
  const byId = new Map(FULL_DMA_QUESTIONS.map((q) => [q.id, q]));
  const items: ScoredItem[] = [];
  let totalHours = 0;

  for (const answer of submission.answers) {
    const q = byId.get(answer.questionId);
    if (!q) continue;

    totalHours += answer.hoursPerWeek || 0;

    // A question is a build signal in proportion to how much it hurts:
    // hours lost, scaled by the stated pain, scaled by how manual it is.
    const manualness = (4 - answer.maturity) / 4;
    const intensity =
      (answer.hoursPerWeek || 0) * (answer.pain / 5) * manualness;

    const builds: BuildWeights = {};
    for (const [buildId, base] of Object.entries(
      DIMENSION_BUILD_AFFINITY[q.dimension]
    ) as [BuildTypeId, number][]) {
      builds[buildId] = base * intensity;
    }

    items.push({
      dimension: q.dimension,
      score: answer.maturity,
      builds,
      signals: answer.maturity <= 1 ? ['MANUAL_ADMIN'] : [],
      hoursPerWeek: answer.hoursPerWeek,
    });
  }

  return rollUp(items, {
    topN: 3,
    hourlyRateUsd: submission.hourlyRateUsd || DEFAULT_HOURLY_RATE_USD,
    totalHoursPerWeek: totalHours || undefined,
  });
}
