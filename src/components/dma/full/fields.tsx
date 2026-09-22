/**
 * Form primitives for the guided DMA.
 *
 * Rules that apply to everything in here, because Joash is talking to a client
 * while he types: no autofocus, no auto-advance, no transition that moves text.
 * Every control has a real <label>; no placeholder is doing a label's job.
 */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from 'react';

export const FIELD_BASE =
  'w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm text-vapor-white ' +
  'placeholder:text-white/25 outline-none transition-colors duration-100 ' +
  'hover:border-white/25 focus:border-tenx-gold ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tenx-gold';

export const LABEL_BASE =
  'block text-[11px] font-medium uppercase tracking-wider text-white/45';

/* ------------------------------------------------------------------ */

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: 'text' | 'password';
  required?: boolean;
  badge?: ReactNode;
  autoComplete?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  type = 'text',
  required = false,
  badge,
  autoComplete = 'off',
}: TextFieldProps) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline gap-2">
        <label htmlFor={id} className={LABEL_BASE}>
          {label}
          {required && <span className="ml-1 text-tenx-gold">*</span>}
        </label>
        {badge}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={FIELD_BASE}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-white/35">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  hint?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  step = 0.5,
  min = 0,
  hint,
}: NumberFieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`${LABEL_BASE} mb-1`}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value === null ? '' : String(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          onChange(Number.isFinite(n) && n >= min ? n : null);
        }}
        className={FIELD_BASE}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-white/35">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface AutoGrowTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  hint?: string;
  labelClassName?: string;
}

/**
 * Grows downward as it fills. Height is set in a layout effect so the browser
 * never paints the intermediate scrollbar, and nothing above the caret moves.
 */
export function AutoGrowTextarea({
  id,
  label,
  value,
  onChange,
  minRows = 3,
  hint,
  labelClassName,
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClassName ?? `${LABEL_BASE} mb-1`}>
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={minRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_BASE} resize-y overflow-hidden leading-relaxed`}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-white/35">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface ScaleOption<T extends number> {
  value: T;
  label: string;
}

interface ScaleSelectorProps<T extends number> {
  name: string;
  legend: string;
  options: ScaleOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  /** Shown to the right of the legend, e.g. the chosen anchor in words. */
  trailing?: ReactNode;
}

/**
 * Real radio inputs, visually hidden, so arrow-key navigation, screen reader
 * announcement and form semantics all come for free.
 */
export function ScaleSelector<T extends number>({
  name,
  legend,
  options,
  value,
  onChange,
  trailing,
}: ScaleSelectorProps<T>) {
  const uid = useId();
  return (
    <fieldset className="min-w-0">
      {/* legend is the first direct child of the fieldset so the radio group
          keeps its accessible name; the trailing hint rides inside it. */}
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
        <span className={LABEL_BASE}>{legend}</span>
        {trailing}
      </legend>
      <div className="grid grid-cols-5 gap-1">
        {options.map((opt) => {
          const id = `${uid}-${opt.value}`;
          const selected = value === opt.value;
          return (
            <div key={opt.value} className="min-w-0">
              <input
                type="radio"
                id={id}
                name={name}
                className="peer sr-only"
                checked={selected}
                value={opt.value}
                onChange={() => onChange(opt.value)}
              />
              <label
                htmlFor={id}
                title={`${opt.value} — ${opt.label}`}
                className={
                  'flex h-full cursor-pointer flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center ' +
                  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-tenx-gold ' +
                  (selected
                    ? 'border-tenx-gold bg-tenx-gold/15 text-vapor-white'
                    : 'border-white/12 bg-black/30 text-white/55 hover:border-white/30 hover:text-white/80')
                }
              >
                <span
                  className={
                    'font-heading text-sm leading-none font-semibold ' +
                    (selected ? 'text-tenx-gold' : '')
                  }
                >
                  {opt.value}
                </span>
                <span className="text-[10px] leading-[1.15] text-balance">
                  {opt.label}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
