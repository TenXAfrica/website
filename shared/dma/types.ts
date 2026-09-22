/**
 * Canonical Digital Maturity Assessment types.
 *
 * This directory is the single source of truth shared by three consumers:
 *   1. the public self-serve score at /assessment (Astro + React)
 *   2. the guided full DMA at /internal/dma (Astro + React)
 *   3. the Cloudflare Worker that scores submissions and writes to Twenty
 *
 * The "@claude Process DMA" routine parses the JSON block written into the CRM
 * Note, so the shapes below are a contract. Add fields; do not rename them.
 */

/** The six dimensions of the assessment. Order is the order they are asked. */
export const DIMENSIONS = [
  'sales',
  'operations',
  'finance',
  'people',
  'data',
  'ai',
] as const;

export type DimensionId = (typeof DIMENSIONS)[number];

export interface Dimension {
  id: DimensionId;
  label: string;
  /** Plain-English description shown above the questions. */
  blurb: string;
  /** Weight in the overall score. All weights sum to 100. */
  weight: number;
}

/** The five build types we quote in year one (catalogue/builds.md). */
export const BUILD_TYPES = [
  'intake_portal',
  'quote_to_invoice',
  'ops_dashboard',
  'doc_generation',
  'inbox_triage',
] as const;

export type BuildTypeId = (typeof BUILD_TYPES)[number];

export interface BuildType {
  id: BuildTypeId;
  label: string;
  /** One sentence the prospect reads on the result page. */
  summary: string;
  /** Catalogue size band, drives which price tier we anchor to. */
  size: 'small' | 'medium';
  /**
   * Share of the hours attributed to this build that the build actually
   * removes. Deliberately conservative: we would rather under-promise.
   */
  automationFactor: number;
}

/** A weighted pointer from an answer to a build type. Higher = stronger signal. */
export type BuildWeights = Partial<Record<BuildTypeId, number>>;

export interface AnswerOption {
  /** Stable id. Never reuse an id for different wording. */
  value: string;
  label: string;
  /** Maturity points, 0 (fully manual) to 4 (fully automated). */
  score: 0 | 1 | 2 | 3 | 4;
  /** Which builds this answer argues for. */
  builds?: BuildWeights;
  /** CRM Company.signals this answer justifies setting. */
  signals?: CompanySignal[];
  /**
   * Estimated hours per week this answer implies are lost to manual work.
   * Only set on the questions that actually ask about time.
   */
  hoursPerWeek?: number;
}

export interface Question {
  id: string;
  dimension: DimensionId;
  /** The question as the owner reads it. No jargon. */
  prompt: string;
  /** Optional clarifier shown smaller, under the prompt. */
  help?: string;
  options: AnswerOption[];
}

/** Company.signals enum in Twenty. Keep in sync with the CRM. */
export type CompanySignal =
  | 'NO_WEBSITE'
  | 'OUTDATED_SITE'
  | 'NOT_MOBILE'
  | 'INSECURE_SITE'
  | 'NO_BOOKING'
  | 'MANUAL_ADMIN'
  | 'HIRING_ADMIN'
  | 'SLOW_RESPONSE'
  | 'FREE_EMAIL'
  | 'ADS_TO_WEAK_PAGE'
  | 'GROWING';

/* ------------------------------------------------------------------ */
/* Self-serve submission                                               */
/* ------------------------------------------------------------------ */

export interface SelfServeContact {
  companyName: string;
  website?: string;
  country: string;
  /** Twenty Company.size enum. */
  size: 'S_1_5' | 'S_6_20' | 'S_21_50' | 'S_51_200' | 'S_200_PLUS';
  sector?: string;
  fullName: string;
  email: string;
  /** Their own words for the biggest weekly time-sink. */
  biggestTimeSink?: string;
  /** Explicit tick. Drives Company.contactConsent. */
  consent: boolean;
}

export interface SelfServeSubmission {
  version: 'dma-selfserve-1';
  /** questionId -> option value */
  answers: Record<string, string>;
  contact: SelfServeContact;
  turnstileToken: string;
  /** Set by the client, used only for the Note. */
  submittedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Full (guided) DMA submission                                        */
/* ------------------------------------------------------------------ */

export interface FullAnswer {
  questionId: string;
  /** How it is done today, in the owner's words. */
  current: string;
  /** Tools named by the owner. */
  tools: string;
  /** Who does it. */
  owner: string;
  /** Hours per week across the business. */
  hoursPerWeek: number;
  /** 1 = fine, 5 = actively painful. */
  pain: 1 | 2 | 3 | 4 | 5;
  /** Maturity 0-4, set by the interviewer against the rubric. */
  maturity: 0 | 1 | 2 | 3 | 4;
}

export interface FullSubmission {
  version: 'dma-full-1';
  /** Twenty Opportunity id this DMA belongs to. Required. */
  opportunityId: string;
  companyId?: string;
  companyName: string;
  /** Blended internal cost per hour in USD, used for the ROI maths. */
  hourlyRateUsd: number;
  answers: FullAnswer[];
  /** dimensionId -> interviewer's free-text notes. */
  notes: Partial<Record<DimensionId, string>>;
  interviewer: string;
  conductedAt: string;
}

/* ------------------------------------------------------------------ */
/* Scoring output                                                      */
/* ------------------------------------------------------------------ */

export interface DimensionScore {
  dimension: DimensionId;
  label: string;
  /** 0-100. */
  score: number;
  /** Raw points earned / points available. */
  raw: { earned: number; available: number };
  band: MaturityBand['id'];
}

export interface MaturityBand {
  id: 'manual' | 'emerging' | 'connected' | 'streamlined' | 'optimised';
  label: string;
  min: number;
  max: number;
  /** What we tell them this band means. */
  meaning: string;
}

export interface BuildRecommendation {
  buildType: BuildTypeId;
  label: string;
  summary: string;
  /** Relative strength of the signal, 0-100. */
  strength: number;
  /** Which dimensions drove this recommendation. */
  drivers: DimensionId[];
  /** Only present when the submission carried hours data. */
  roi?: {
    hoursPerWeekRecovered: number;
    annualHoursRecovered: number;
    annualValueUsd: number;
  };
  /** Catalogue price band in USD. */
  priceBand: { low: number; high: number; tier: 'Launch' | 'Growth' | 'Scale' };
}

export interface ScoreResult {
  overall: number;
  band: MaturityBand;
  dimensions: DimensionScore[];
  recommendations: BuildRecommendation[];
  /** Company.signals to write to the CRM. */
  signals: CompanySignal[];
  /** Provisional Company.fitScore. */
  fitScore: 'RATING_1' | 'RATING_2' | 'RATING_3' | 'RATING_4' | 'RATING_5';
  /** Total estimated hours per week lost to manual work, when known. */
  estimatedHoursPerWeek?: number;
}
