import React, { useEffect, useId, useRef, useState } from 'react';
import TurnstileImport from 'react-turnstile';
import { DMA_WORKER_URL, TURNSTILE_SITE_KEY } from './dma/util';

// react-turnstile ships CommonJS; during the static build the default import
// arrives wrapped in an object, so unwrap it before rendering.
const Turnstile = ((TurnstileImport as unknown as { default?: typeof TurnstileImport }).default ?? TurnstileImport) as typeof TurnstileImport;

/**
 * The /contact form.
 *
 * Where it posts, in order of precedence:
 * 1. PUBLIC_CONTACT_WEBHOOK_URL, if set at build time (any endpoint that
 *    accepts the JSON body below).
 * 2. <DMA Worker>/api/contact. This is the same Cloudflare Worker the
 *    assessment uses; it checks Turnstile, rate-limits, and writes a Company,
 *    Person, Note and an "@claude Follow up contact" Task into the CRM.
 * 3. Nothing (local dev with neither set): the submission is simulated.
 *
 * The Worker's contact contract accepts fullName, email, company, website,
 * phone, message, consent and turnstileToken. It does not store country or
 * the weekly time-sink as separate fields, so both are folded into the
 * message text as well as sent on their own, and nothing is lost.
 */

const CONTACT_ENDPOINT: string = (() => {
    const explicit = (import.meta.env.PUBLIC_CONTACT_WEBHOOK_URL as string | undefined)?.trim();
    if (explicit) return explicit;
    if (DMA_WORKER_URL) return `${DMA_WORKER_URL}/api/contact`;
    return '';
})();

const LIMITS = {
    name: 200,
    email: 320,
    company: 200,
    country: 100,
    timeSink: 400,
    message: 1400,
} as const;

interface ContactFormProps {
    className?: string;
}

interface FormState {
    name: string;
    email: string;
    company: string;
    country: string;
    timeSink: string;
    message: string;
    consent: boolean;
}

type FieldName = keyof FormState | 'turnstile';
type Errors = Partial<Record<FieldName, string>>;
type Status = 'idle' | 'sending' | 'success' | 'error';

const EMPTY: FormState = {
    name: '',
    email: '',
    company: '',
    country: '',
    timeSink: '',
    message: '',
    consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Field styles: 48px controls, interactive border, gold focus ring.
const CONTROL =
    'block w-full min-h-12 rounded-[2px] border border-border-interactive bg-surface-1 px-4 py-3 ' +
    'text-base text-vapor-white placeholder:text-text-faint ' +
    'transition-colors duration-150 ' +
    'focus:border-tenx-gold focus:outline-2 focus:outline-offset-2 focus:outline-tenx-gold';
const CONTROL_INVALID = 'border-signal-bad';
const LABEL = 'block text-[0.9375rem] font-medium text-vapor-white';
const HINT = 'mt-1 text-[0.8125rem] leading-snug text-text-muted';
const ERROR = 'mt-2 text-[0.9375rem] text-signal-bad';

function validate(form: FormState, turnstileToken: string): Errors {
    const errors: Errors = {};
    if (!form.name.trim()) errors.name = 'Enter your name.';
    if (!form.email.trim()) errors.email = 'Enter your work email.';
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter an email address like name@company.com.';
    if (!form.company.trim()) errors.company = 'Enter your company name.';
    if (!form.country.trim()) errors.country = 'Enter the country your business is in.';
    if (!form.message.trim()) errors.message = 'Tell us a little about what you need.';
    if (!form.consent) errors.consent = 'Tick the box so we can reply to your enquiry.';
    if (!turnstileToken) errors.turnstile = 'Wait for the security check to finish, then send again.';
    return errors;
}

function composeMessage(form: FormState): string {
    const lines = [`Country: ${form.country.trim()}`];
    if (form.timeSink.trim()) lines.push(`Biggest weekly time-sink: ${form.timeSink.trim()}`);
    lines.push('', form.message.trim());
    return lines.join('\n');
}

export const ContactForm: React.FC<ContactFormProps> = ({ className }) => {
    const uid = useId();
    const id = (name: string) => `${uid}-${name}`;

    const [form, setForm] = useState<FormState>(EMPTY);
    const [errors, setErrors] = useState<Errors>({});
    const [status, setStatus] = useState<Status>('idle');
    const [announcement, setAnnouncement] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileKey, setTurnstileKey] = useState(0);
    const [turnstileBroken, setTurnstileBroken] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const successRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (status === 'success') successRef.current?.focus();
    }, [status]);

    const update = <K extends keyof FormState>(name: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const onText =
        (name: Exclude<keyof FormState, 'consent'>) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            update(name, e.target.value);

    const focusFirstError = (errs: Errors) => {
        const order: FieldName[] = ['name', 'email', 'company', 'country', 'timeSink', 'message', 'consent'];
        const first = order.find((k) => errs[k]);
        if (first) {
            document.getElementById(id(first))?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'sending') return;

        const errs = validate(form, turnstileToken);
        setErrors(errs);
        const count = Object.values(errs).filter(Boolean).length;
        if (count > 0) {
            setAnnouncement(
                count === 1 ? 'One thing needs fixing before we can send this.' : `${count} things need fixing before we can send this.`
            );
            focusFirstError(errs);
            return;
        }

        setStatus('sending');
        setAnnouncement('Sending your message.');

        const payload = {
            fullName: form.name.trim(),
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim(),
            country: form.country.trim(),
            biggestTimeSink: form.timeSink.trim(),
            message: composeMessage(form),
            consent: form.consent,
            turnstileToken,
            source: 'website-contact',
            submittedAt: new Date().toISOString(),
        };

        try {
            if (!CONTACT_ENDPOINT) {
                // Local development with no endpoint configured.
                console.warn('No contact endpoint configured. Simulating submission.');
                await new Promise((resolve) => setTimeout(resolve, 800));
                setStatus('success');
                setAnnouncement('Message sent.');
                setForm(EMPTY);
                return;
            }

            const response = await fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = (await response.json().catch(() => null)) as
                | { ok?: boolean; error?: string; status?: string; message?: string }
                | null;

            const captchaFailed =
                data?.error === 'turnstile_failed' ||
                data?.error === 'turnstile_missing' ||
                (data?.status === 'error' && data?.message === 'Invalid Captcha');

            if (captchaFailed) {
                setTurnstileToken('');
                setTurnstileKey((k) => k + 1);
                setErrors({ turnstile: 'The security check did not pass. Wait for it to reload, then send again.' });
                setStatus('idle');
                setAnnouncement('The security check did not pass. Please try again.');
                return;
            }

            // Older webhook convention: an existing lead is still a delivered message.
            const alreadyKnown = data?.status === 'error' && data?.message === 'Lead already exists';
            const failed = !alreadyKnown && (!response.ok || data?.ok === false || data?.status === 'error');
            if (failed) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);

            setStatus('success');
            setAnnouncement('Message sent.');
            setForm(EMPTY);
        } catch (err) {
            console.error('Contact form submission failed:', err);
            setStatus('error');
            setAnnouncement('Your message did not send. You can try again or email joash@tenxafrica.co.za.');
            setTurnstileToken('');
            setTurnstileKey((k) => k + 1);
        }
    };

    const describedBy = (name: FieldName, hint = false) =>
        [hint ? id(`${name}-hint`) : '', errors[name] ? id(`${name}-error`) : ''].filter(Boolean).join(' ') || undefined;

    const fieldError = (name: FieldName) =>
        errors[name] ? (
            <p id={id(`${name}-error`)} className={ERROR}>
                {errors[name]}
            </p>
        ) : null;

    const statusRegion = (
        <p role="status" aria-live="polite" className="sr-only">
            {announcement}
        </p>
    );

    if (status === 'success') {
        return (
            <div className={className}>
                {statusRegion}
                <div className="border-t border-rule pt-8">
                    <h2 ref={successRef} tabIndex={-1} className="t-h2 text-vapor-white focus:outline-none">
                        Thanks. Your message is with us.
                    </h2>
                    <p className="t-body mt-4 max-w-[34rem] text-text-muted">
                        Joash reads every enquiry and usually replies within one working day, from joash@tenxafrica.co.za.
                        If you would rather talk now, book the free 45-minute assessment.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                        <a
                            href="https://bookings.cloud.microsoft/book/DiscoveryCall@tenxafrica.co.za/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                        >
                            Book the assessment
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                        <button
                            type="button"
                            onClick={() => {
                                setStatus('idle');
                                setAnnouncement('');
                                setErrors({});
                            }}
                            className="btn-quiet"
                        >
                            Send another message
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            {statusRegion}
            <form ref={formRef} onSubmit={handleSubmit} noValidate aria-describedby={id('required-note')}>
                <p id={id('required-note')} className="t-small text-text-muted">
                    All fields are required except the weekly time-sink.
                </p>

                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                        <label htmlFor={id('name')} className={LABEL}>
                            Your name
                        </label>
                        <input
                            id={id('name')}
                            name="name"
                            type="text"
                            autoComplete="name"
                            required
                            maxLength={LIMITS.name}
                            value={form.name}
                            onChange={onText('name')}
                            aria-invalid={errors.name ? true : undefined}
                            aria-describedby={describedBy('name')}
                            className={`${CONTROL} mt-2 ${errors.name ? CONTROL_INVALID : ''}`}
                        />
                        {fieldError('name')}
                    </div>

                    <div>
                        <label htmlFor={id('email')} className={LABEL}>
                            Work email
                        </label>
                        <input
                            id={id('email')}
                            name="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            required
                            maxLength={LIMITS.email}
                            value={form.email}
                            onChange={onText('email')}
                            aria-invalid={errors.email ? true : undefined}
                            aria-describedby={describedBy('email')}
                            className={`${CONTROL} mt-2 ${errors.email ? CONTROL_INVALID : ''}`}
                        />
                        {fieldError('email')}
                    </div>

                    <div>
                        <label htmlFor={id('company')} className={LABEL}>
                            Company
                        </label>
                        <input
                            id={id('company')}
                            name="company"
                            type="text"
                            autoComplete="organization"
                            required
                            maxLength={LIMITS.company}
                            value={form.company}
                            onChange={onText('company')}
                            aria-invalid={errors.company ? true : undefined}
                            aria-describedby={describedBy('company')}
                            className={`${CONTROL} mt-2 ${errors.company ? CONTROL_INVALID : ''}`}
                        />
                        {fieldError('company')}
                    </div>

                    <div>
                        <label htmlFor={id('country')} className={LABEL}>
                            Country
                        </label>
                        <input
                            id={id('country')}
                            name="country"
                            type="text"
                            autoComplete="country-name"
                            required
                            maxLength={LIMITS.country}
                            value={form.country}
                            onChange={onText('country')}
                            aria-invalid={errors.country ? true : undefined}
                            aria-describedby={describedBy('country')}
                            className={`${CONTROL} mt-2 ${errors.country ? CONTROL_INVALID : ''}`}
                        />
                        {fieldError('country')}
                    </div>

                    <div className="sm:col-span-2">
                        <label htmlFor={id('timeSink')} className={LABEL}>
                            What takes the most time each week?{' '}
                            <span className="font-normal text-text-muted">(optional)</span>
                        </label>
                        <p id={id('timeSink-hint')} className={HINT}>
                            For example: re-typing enquiries into a spreadsheet, chasing unpaid invoices, building the monthly report.
                        </p>
                        <textarea
                            id={id('timeSink')}
                            name="timeSink"
                            rows={2}
                            maxLength={LIMITS.timeSink}
                            value={form.timeSink}
                            onChange={onText('timeSink')}
                            aria-describedby={describedBy('timeSink', true)}
                            className={`${CONTROL} mt-2 resize-y`}
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label htmlFor={id('message')} className={LABEL}>
                            Message
                        </label>
                        <textarea
                            id={id('message')}
                            name="message"
                            rows={5}
                            required
                            maxLength={LIMITS.message}
                            value={form.message}
                            onChange={onText('message')}
                            aria-invalid={errors.message ? true : undefined}
                            aria-describedby={describedBy('message')}
                            className={`${CONTROL} mt-2 resize-y ${errors.message ? CONTROL_INVALID : ''}`}
                        />
                        {fieldError('message')}
                    </div>

                    <div className="sm:col-span-2">
                        <div className="flex items-start gap-3">
                            <input
                                id={id('consent')}
                                name="consent"
                                type="checkbox"
                                required
                                checked={form.consent}
                                onChange={(e) => update('consent', e.target.checked)}
                                aria-invalid={errors.consent ? true : undefined}
                                aria-describedby={describedBy('consent')}
                                className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-[2px] border border-border-interactive bg-surface-1 accent-tenx-gold focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-tenx-gold"
                            />
                            <label htmlFor={id('consent')} className="cursor-pointer text-[0.9375rem] leading-relaxed text-text-muted">
                                Ten X Africa may contact me about this enquiry. We use your details only to reply, as set
                                out in our{' '}
                                <a href="/privacy" className="text-tenx-gold underline underline-offset-2">
                                    privacy notice
                                </a>
                                .
                            </label>
                        </div>
                        {fieldError('consent')}
                    </div>

                    <div className="sm:col-span-2">
                        <Turnstile
                            key={turnstileKey}
                            sitekey={TURNSTILE_SITE_KEY}
                            theme="dark"
                            onVerify={(token) => {
                                setTurnstileToken(token);
                                setTurnstileBroken(false);
                                setErrors((prev) => ({ ...prev, turnstile: undefined }));
                            }}
                            onError={() => setTurnstileBroken(true)}
                            onTimeout={() => setTurnstileBroken(true)}
                            onExpire={() => setTurnstileToken('')}
                        />
                        {errors.turnstile && (
                            <p id={id('turnstile-error')} className={ERROR}>
                                {errors.turnstile}
                            </p>
                        )}
                        {turnstileBroken && !errors.turnstile && (
                            <p className={HINT}>
                                The security check did not load. Refresh the page, or email joash@tenxafrica.co.za instead.
                            </p>
                        )}
                    </div>
                </div>

                {status === 'error' && (
                    <p className="mt-8 border-l-2 border-signal-bad pl-4 text-[0.9375rem] text-signal-bad">
                        Your message did not send. Please try again, or email{' '}
                        <a href="mailto:joash@tenxafrica.co.za" className="underline underline-offset-2">
                            joash@tenxafrica.co.za
                        </a>
                        .
                    </p>
                )}

                <div className="mt-8">
                    <button
                        type="submit"
                        disabled={status === 'sending'}
                        aria-busy={status === 'sending'}
                        className="btn btn-primary disabled:cursor-wait disabled:opacity-70"
                    >
                        {status === 'sending' ? 'Sending…' : 'Send message'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ContactForm;
