/**
 * Session setup. Everything here can be handed over from the CRM as query
 * params (?company=&opportunityId=&companyId=) so a link, or a future routine,
 * can drop Joash straight into a prepared session.
 *
 * The Worker token lives in a password field and in sessionStorage (this tab only). It is never
 * written into the draft, never into the report, and never into the build.
 */

import { NumberField, TextField } from './fields';
import type { SetupState } from './draft';

export interface SetupHeaderProps {
  setup: SetupState;
  onPatch: (patch: Partial<SetupState>) => void;
  /** Which fields arrived on the URL, so the source is visible. */
  fromUrl: ReadonlySet<keyof SetupState>;
  token: string;
  onTokenChange: (v: string) => void;
  workerUrl: string;
}

function FromLink() {
  return (
    <span className="rounded border border-tenx-gold/40 px-1 py-px text-xs tracking-wider text-tenx-gold/80 uppercase">
      from link
    </span>
  );
}

export function SetupHeader({
  setup,
  onPatch,
  fromUrl,
  token,
  onTokenChange,
  workerUrl,
}: SetupHeaderProps) {
  const missing: string[] = [];
  if (setup.companyName.trim() === '') missing.push('company name');
  if (setup.opportunityId.trim() === '') missing.push('Opportunity id');

  return (
    <section
      aria-label="Session setup"
      className="border-b border-rule bg-surface-1"
    >
      <div className="mx-auto max-w-[1600px] px-4 py-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <TextField
              id="setup-company"
              label="Company name"
              required
              value={setup.companyName}
              onChange={(v) => onPatch({ companyName: v })}
              badge={fromUrl.has('companyName') ? <FromLink /> : undefined}
            />
          </div>
          <TextField
            id="setup-opportunity"
            label="Opportunity id"
            required
            value={setup.opportunityId}
            onChange={(v) => onPatch({ opportunityId: v })}
            hint="Where the Note lands. Also the autosave key."
            badge={fromUrl.has('opportunityId') ? <FromLink /> : undefined}
          />
          <TextField
            id="setup-companyid"
            label="Company id"
            value={setup.companyId}
            onChange={(v) => onPatch({ companyId: v })}
            hint="Optional."
            badge={fromUrl.has('companyId') ? <FromLink /> : undefined}
          />
          <TextField
            id="setup-interviewer"
            label="Interviewer"
            value={setup.interviewer}
            onChange={(v) => onPatch({ interviewer: v })}
          />
          <NumberField
            id="setup-rate"
            label="Blended rate (USD/h)"
            value={setup.hourlyRateUsd}
            onChange={(v) => onPatch({ hourlyRateUsd: v ?? 0 })}
            step={5}
            min={1}
            hint="Drives the ROI maths."
          />
        </div>

        <div className="mt-3 grid gap-3 border-t border-rule pt-3 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <TextField
            id="setup-token"
            label="Worker token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={onTokenChange}
            hint="Remembered in this browser only. Needed for submit, not for the copy/download fallback."
          />
          <div className="self-end text-xs leading-snug text-text-faint">
            <p>
              Posting to{' '}
              <code className="text-text-muted">
                {workerUrl ? `${workerUrl}/api/dma/full` : 'PUBLIC_DMA_WORKER_URL is not set'}
              </code>
            </p>
            {missing.length > 0 && (
              <p className="mt-1 text-amber-300/80">
                Still needed before submit: {missing.join(' and ')}.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SetupHeader;
