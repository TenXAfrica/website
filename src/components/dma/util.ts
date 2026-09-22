import { useEffect, useState } from 'react';
import { SELF_SERVE_QUESTIONS, DIMENSION_META } from '../../../shared/dma/questions';
import type { DimensionId } from '../../../shared/dma/types';

/* ------------------------------------------------------------------ */
/* Deep-linking                                                        */
/* ------------------------------------------------------------------ */

/**
 * Answers travel in the URL hash as one character per question, in
 * SELF_SERVE_QUESTIONS order: the index of the chosen option, or "x" if it
 * was not answered. Twelve characters, no personal data, stable across
 * option re-wording as long as option order holds.
 */
export const HASH_PREFIX = '#r=';

export function encodeAnswers(answers: Record<string, string>): string {
  return SELF_SERVE_QUESTIONS.map((q) => {
    const index = q.options.findIndex((o) => o.value === answers[q.id]);
    return index < 0 ? 'x' : String(index);
  }).join('');
}

export function decodeAnswers(hash: string): Record<string, string> | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const code = hash.slice(HASH_PREFIX.length);
  if (code.length !== SELF_SERVE_QUESTIONS.length) return null;

  const answers: Record<string, string> = {};
  for (let i = 0; i < SELF_SERVE_QUESTIONS.length; i += 1) {
    const char = code[i];
    if (char === 'x') continue;
    const index = Number(char);
    const option = SELF_SERVE_QUESTIONS[i].options[index];
    if (!Number.isInteger(index) || !option) return null;
    answers[SELF_SERVE_QUESTIONS[i].id] = option.value;
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

/* ------------------------------------------------------------------ */
/* Field helpers                                                       */
/* ------------------------------------------------------------------ */

/** Accepts bare domains. "acme.co.za" and "www.acme.co.za/x" both pass. */
const DOMAINISH = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i;

export function normaliseWebsite(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

export function websiteLooksWrong(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  const bare = value.replace(/^https?:\/\//i, '').replace(/^\/+/, '');
  return !DOMAINISH.test(bare);
}

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function emailLooksValid(input: string): boolean {
  return EMAIL.test(input.trim());
}

/**
 * Personal mailboxes. We nudge once, then take whatever they give us —
 * a real lead with a Gmail address beats an abandoned form.
 */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.za',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'live.co.uk',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'zoho.com',
  'webmail.co.za',
  'vodamail.co.za',
  'telkomsa.net',
  'mweb.co.za',
]);

export function isFreeEmail(input: string): boolean {
  const domain = input.trim().toLowerCase().split('@')[1];
  return !!domain && FREE_EMAIL_DOMAINS.has(domain);
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

const DIMENSION_LABELS = new Map(DIMENSION_META.map((d) => [d.id, d.label]));

export function dimensionLabel(id: DimensionId): string {
  return DIMENSION_LABELS.get(id) ?? id;
}

/** "Sales and customer handling and Data and systems" reads badly. */
export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** Flips to true one frame after mount so CSS transitions actually run. */
export function useMounted(delayMs = 60): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return mounted;
}
