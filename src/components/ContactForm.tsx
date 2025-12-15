import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

import {
    getCountries,
    getCountryCallingCode,
    parsePhoneNumber,
    formatPhoneNumberIntl
} from 'react-phone-number-input';
import type { CountryCode } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';
import en from 'react-phone-number-input/locale/en.json';
import { GoldButton } from './GoldButton';
import Turnstile from 'react-turnstile';
import type { ContactInterest } from '../types/components';

interface ContactFormProps {
    interests: {
        value: ContactInterest;
        label: string;
        description?: string;
        subOptions?: {
            value: string;
            label: string;
        }[];
    }[];
    submitText?: string;
    successMessage?: string;
    errorMessage?: string;
    placeholders?: {
        name: string;
        email: string;
        phone: string;
        company: string;
        message: string;
    };
    className?: string;
    defaultInterest?: ContactInterest;
}

interface FormState {
    name: string;
    email: string;
    phone: string | undefined;
    company: string;
    role: string;
    website: string;
    interest: ContactInterest;
    subInterest?: string; // e.g., 'startup' | 'investor'
    applicantType?: 'individual' | 'company';
    message: string;
    turnstileToken?: string;
}

/**
 * Multi-step, dynamic contact form.
 */
export const ContactForm: React.FC<ContactFormProps> = ({
    interests,
    submitText = 'Send Message',
    successMessage = "We'll get back to you within 24-48 hours.",
    errorMessage = 'Something went wrong. Please try again or email us directly.',
    placeholders = {
        name: 'Your full name',
        email: 'you@company.com',
        phone: '+XX XX XXX XXXX',
        company: 'Your organization',
        message: 'Tell us about your needs...',
    },
    className,
    defaultInterest = 'general',
}) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormState>({
        name: '',
        email: '',
        phone: undefined,
        company: '',
        role: '',
        website: '',
        interest: defaultInterest,
        applicantType: 'company',
        message: '',
    });

    // Phone Input State
    const [country, setCountry] = useState<CountryCode>('ZA');
    // We keep a separate "display" value for the input so we don't force format while typing
    const [phoneDisplay, setPhoneDisplay] = useState('');

    // Update display if form.phone is set externally (e.g. drafts or prepopulation)
    // simplistic check to avoid overwrite loop
    useEffect(() => {
        if (form.phone && form.phone !== phoneDisplay && !phoneDisplay) {
            setPhoneDisplay(form.phone);
        }
    }, [form.phone]);

    // Update placeholder based on selected country
    // We can use getExampleNumber or similar if we want deeper logic, 
    // but honestly just removing the "+XX" hardcode and letting it be "Phone Number" or similar is better UX if dynamic isn't easy.
    // However, the user specifically hated "+27 ...". 
    // Let's just use "Phone Number" or void to keep it clean, as the country code next to it implies the format somewhat.
    // Or better, we just show the Calling Code in the select, and the input is empty.

    const handlePhoneBlur = () => {
        if (!phoneDisplay) return;

        // Try to parse with selected country
        // parsePhoneNumber returns undefined if invalid
        const phoneNumber = parsePhoneNumber(phoneDisplay, country);

        if (phoneNumber) {
            // Valid-ish number
            // Update display to nice international format
            setPhoneDisplay(formatPhoneNumberIntl(phoneNumber.number) || phoneDisplay);
            // Update form state to E.164
            setForm(prev => ({ ...prev, phone: phoneNumber.number as string }));
        } else {
            // Invalid, just sending raw text? Or maybe keep it as is?
            // User requirement: "updates ... if they enter it wrong ... on blur"
            // If it's totally invalid garbage, we can't format it. 
            // We'll just leave it and let the user see it's wrong (maybe add validation later)
            // But we should ensure form.phone gets the raw value at least so validation can catch it
            setForm(prev => ({ ...prev, phone: phoneDisplay }));
        }
    };

    // Determine total steps based on interest
    // Step 1: Door Selection
    // Step 2: Context/Details
    // Step 3: Contact Info
    const totalSteps = 3;

    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'exists'>('idle');
    const [serverMessage, setServerMessage] = useState('');

    // Pre-select door if valid defaultInterest provided
    // Check for URL parameters on mount to override default/selection
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const interestParam = params.get('interest');
            const subOptionsParam = params.get('sub'); // Optional if we want to deep link sub-options too

            if (interestParam) {
                const found = interests.find(i => i.value === interestParam);
                if (found) {
                    setForm(prev => ({
                        ...prev,
                        interest: found.value as ContactInterest,
                        // If deep link has sub-option (e.g. ?interest=catalyst&sub=investor)
                        subInterest: subOptionsParam || undefined
                    }));
                }
            }
        }
    }, [interests]);

    const activeInterest = interests.find(i => i.value === form.interest);

    const validateStep = (currentStep: number): boolean => {
        const newErrors: Partial<Record<keyof FormState, string>> = {};

        if (currentStep === 1) {
            // Validate Door Selection
            if (!form.interest) newErrors.interest = 'Please select an option';
            // If catalyst, validate sub-interest
            if (form.interest === 'catalyst' && !form.subInterest) {
                // We handle this in the UI by forcing selection to advance, but good to have check
            }
        }

        if (currentStep === 2) {
            // Validate Context Fields
            // Catalyst Startup/Investor logic:
            // If user explicitly says they are a COMPANY, require company name.
            // If they are an INDIVIDUAL, we skip company name.

            const isCompany = form.applicantType === 'company';
            const isStartup = form.interest === 'catalyst' && form.subInterest === 'startup';

            if (isCompany) {
                if (!form.company.trim()) newErrors.company = 'Organization name is required';
            }

            // For startups, we usually want a website, but strict requirement might block early stage individuals.
            // Let's keep it required for COMPANIES, optional for INDIVIDUALS? 
            // Or just required if they have one. Let's make it required for Startups generally, 
            // but if they are an individual maybe they don't have one yet?
            // User request was just to allow the flow. Let's make website required only if isCompany for now, 
            // or maybe just relax it for individuals. 
            // Let's enforce website for Startups (Company) but optional for Startup (Individual).
            if (isStartup && isCompany) {
                if (!form.website.trim()) newErrors.website = 'Website URL is required';
            }
        }

        if (currentStep === 3) {
            // Validate Contact Info
            if (!form.name.trim()) newErrors.name = 'Name is required';
            if (!form.email.trim()) {
                newErrors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
                newErrors.email = 'Please enter a valid email';
            }
            if (!form.message.trim()) newErrors.message = 'Message is required';
            if (!form.turnstileToken) newErrors.turnstileToken = 'Please complete the security check';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const handleBack = () => {
        setStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep(3)) return;

        setIsSubmitting(true);
        setSubmitStatus('idle');
        setServerMessage('');

        try {
            const webhookUrl = import.meta.env.PUBLIC_CONTACT_WEBHOOK_URL;

            if (!webhookUrl) {
                console.warn('PUBLIC_CONTACT_WEBHOOK_URL is not set. Simulating submission.');
                console.log('Webhook Payload:', { ...form, submittedAt: new Date().toISOString() });
                await new Promise(resolve => setTimeout(resolve, 1500));
                setSubmitStatus('success');
            } else {
                const payload = { ...form, submittedAt: new Date().toISOString() };
                console.log('Webhook Payload:', payload);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                // Parse response manually to handle n8n custom statuses
                const data = await response.json().catch(() => null);

                if (data && data.status === 'error') {
                    if (data.message === 'Invalid Captcha') {
                        setErrors(prev => ({ ...prev, turnstileToken: 'Security check failed. Please try again.' }));
                        // Reset turnstile here ideally if we had a ref, or just let user re-click
                        throw new Error('Invalid CAPTCHA');
                    }
                    if (data.message === 'Lead already exists') {
                        setSubmitStatus('exists');
                        return; // Exit here, 'exists' is treated as a handled state
                    }
                    throw new Error(data.message || 'Submission failed');
                }

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                // If success (or just 200 OK with no specific error body)
                setSubmitStatus('success');
            }

            setForm(prev => ({ ...prev, message: '' }));
        } catch (error) {
            console.error('Form submission error:', error);
            if (error instanceof Error && error.message !== 'Invalid CAPTCHA') {
                // Only show generic error if it wasn't a handled UI error
                setSubmitStatus('error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormState]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    // Helper to render current step content
    const renderStepContent = () => {
        const inputClasses = 'w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:border-tenx-gold/50 focus:outline-none focus:ring-1 focus:ring-tenx-gold/50 transition-colors';
        const labelClasses = 'block text-sm font-medium text-white/80 mb-2';
        const errorClasses = 'text-xs text-red-400 mt-1';

        switch (step) {
            case 1: // The Doors
                return (
                    <div className="space-y-6">
                        <h2 className="text-xl font-heading font-bold text-white mb-6">How can we help you?</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {interests.map((item) => (
                                <motion.div
                                    key={item.value}
                                    onClick={() => {
                                        setForm(prev => ({ ...prev, interest: item.value, subInterest: undefined }));
                                        // Auto-advance if no sub-options
                                        if (!item.subOptions) {
                                            // slightly delayed for visual feedback
                                            setTimeout(() => setStep(2), 200);
                                        }
                                    }}
                                    className={twMerge(
                                        'cursor-pointer relative overflow-hidden rounded-xl p-5 border transition-all duration-300',
                                        form.interest === item.value
                                            ? 'bg-tenx-gold/10 border-tenx-gold'
                                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                                    )}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <h3 className={twMerge("font-heading font-bold text-lg mb-2", form.interest === item.value ? "text-tenx-gold" : "text-white")}>
                                        {item.label}
                                    </h3>
                                    {item.description && <p className="text-sm text-white/60 mb-4">{item.description}</p>}

                                    {/* Sub-options for Catalyst */}
                                    {item.subOptions && form.interest === item.value && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="space-y-2 mt-4 pt-4 border-t border-white/10"
                                        >
                                            <p className="text-xs text-tenx-gold uppercase tracking-wider font-bold mb-2">Select your role:</p>
                                            {item.subOptions.map(sub => (
                                                <div
                                                    key={sub.value}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setForm(prev => ({ ...prev, subInterest: sub.value }));
                                                        setTimeout(() => setStep(2), 200);
                                                    }}
                                                    className={twMerge(
                                                        "p-3 rounded-lg border text-sm transition-colors flex items-center justify-between",
                                                        form.subInterest === sub.value
                                                            ? "bg-tenx-gold text-black border-tenx-gold"
                                                            : "bg-black/20 border-white/10 hover:border-white/30 text-white"
                                                    )}
                                                >
                                                    {sub.label}
                                                    {form.subInterest === sub.value && <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                );

            case 2: // Details
                const isCatalystStartup = form.interest === 'catalyst' && form.subInterest === 'startup';
                const isCatalystInvestor = form.interest === 'catalyst' && form.subInterest === 'investor';
                // Now allow toggle for consulting AND catalyst as well
                const showCompanyToggle = form.interest === 'general' || form.interest === 'network' || form.interest === 'consulting' || form.interest === 'catalyst';

                return (
                    <div className="space-y-6">
                        <h2 className="text-xl font-heading font-bold text-white mb-6">
                            {isCatalystStartup ? 'Startup Details' :
                                isCatalystInvestor ? 'Investment Profile' :
                                    'Tell us a bit more'}
                        </h2>

                        {showCompanyToggle && (
                            <div className="flex gap-4 mb-6">
                                {(['company', 'individual'] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, applicantType: type }))}
                                        className={twMerge(
                                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                                            form.applicantType === type
                                                ? "bg-tenx-gold text-black border-tenx-gold"
                                                : "bg-transparent text-white/60 border-white/10 hover:border-white/30"
                                        )}
                                    >
                                        I represent a {type === 'company' ? 'Company' : 'Individual'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            {(form.applicantType === 'company') && (
                                <>
                                    <div className="md:col-span-2">
                                        <label htmlFor="company" className={labelClasses}>
                                            {isCatalystStartup ? 'Startup Name' : isCatalystInvestor ? 'Firm / Organization Name' : 'Organization Name'} <span className="text-tenx-gold">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="company"
                                            name="company"
                                            value={form.company}
                                            onChange={handleChange}
                                            placeholder={placeholders.company}
                                            className={twMerge(inputClasses, errors.company && 'border-red-400')}
                                        />
                                        {errors.company && <p className={errorClasses}>{errors.company}</p>}
                                    </div>

                                    <div>
                                        <label htmlFor="role" className={labelClasses}>Your Role</label>
                                        <input
                                            type="text"
                                            id="role"
                                            name="role"
                                            value={form.role}
                                            onChange={handleChange}
                                            placeholder="e.g. CEO, Partner, Manager"
                                            className={inputClasses}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="website" className={labelClasses}>Website {isCatalystStartup && <span className="text-tenx-gold">*</span>}</label>
                                        <input
                                            type="url"
                                            id="website"
                                            name="website"
                                            value={form.website}
                                            onChange={handleChange}
                                            placeholder="https://..."
                                            className={twMerge(inputClasses, errors.website && 'border-red-400')}
                                        />
                                        {errors.website && <p className={errorClasses}>{errors.website}</p>}
                                    </div>
                                </>
                            )}

                            {/* If purely individual general inquiry, maybe just skip straight to message? 
                                But let's keep it consistent. */}
                        </div>
                    </div>
                );

            case 3: // Contact Info & Message
                return (
                    <div className="space-y-6">
                        <h2 className="text-xl font-heading font-bold text-white mb-6">Final Step: Contact Info</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="name" className={labelClasses}>Full Name <span className="text-tenx-gold">*</span></label>
                                <input type="text" id="name" name="name" value={form.name} onChange={handleChange} placeholder={placeholders.name} className={twMerge(inputClasses, errors.name && 'border-red-400')} />
                                {errors.name && <p className={errorClasses}>{errors.name}</p>}
                            </div>
                            <div>
                                <label htmlFor="email" className={labelClasses}>Email <span className="text-tenx-gold">*</span></label>
                                <input type="email" id="email" name="email" value={form.email} onChange={handleChange} placeholder={placeholders.email} className={twMerge(inputClasses, errors.email && 'border-red-400')} />
                                {errors.email && <p className={errorClasses}>{errors.email}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="phone" className={labelClasses}>Phone</label>
                                <div className={twMerge(inputClasses, "py-0 pl-0 flex items-center p-0 overflow-hidden focus-within:border-tenx-gold/50 focus-within:ring-1 focus-within:ring-tenx-gold/50")}>
                                    {/* Custom Country Select */}
                                    <div className="relative border-r border-white/10 h-full max-w-[120px] md:max-w-[180px] flex-shrink-0">
                                        <select
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value as CountryCode)}
                                            className="appearance-none bg-transparent text-white/80 py-3 pl-4 pr-8 focus:outline-none cursor-pointer h-full w-full truncate text-base md:text-sm"
                                        >
                                            {getCountries().map((c) => (
                                                <option key={c} value={c} className="bg-black text-white">
                                                    {en[c]} +{getCountryCallingCode(c)}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>

                                    <input
                                        type="tel"
                                        value={phoneDisplay}
                                        onChange={(e) => {
                                            setPhoneDisplay(e.target.value);
                                            // Also update form state on change (raw) to prevent lag if they submit immediately?
                                            // Actually, safer to update form only on blur or submit if we want strict formatting?
                                            // Let's update raw to form state so 'required' checks pass if they type but don't blur
                                            setForm(prev => ({ ...prev, phone: e.target.value }));
                                        }}
                                        onBlur={handlePhoneBlur}

                                        placeholder="Phone number"
                                        className="flex-1 bg-transparent border-none text-white placeholder:text-white/30 px-4 py-3 focus:ring-0 focus:outline-none text-base md:text-sm min-w-0"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <textarea id="message" name="message" value={form.message} onChange={handleChange} placeholder={placeholders.message} rows={4} className={twMerge(inputClasses, 'resize-none', errors.message && 'border-red-400')} />
                                {errors.message && <p className={errorClasses}>{errors.message}</p>}
                            </div>

                            <div className="md:col-span-2 flex justify-center py-4">
                                <Turnstile
                                    sitekey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                                    onVerify={(token) => {
                                        setForm(prev => ({ ...prev, turnstileToken: token }));
                                        setErrors(prev => ({ ...prev, turnstileToken: undefined }));
                                    }}
                                    theme="dark"
                                />
                                {errors.turnstileToken && <p className={twMerge(errorClasses, "block text-center w-full")}>{errors.turnstileToken}</p>}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    if (submitStatus === 'success') {
        return (
            <motion.div className={twMerge("bg-black/60 backdrop-blur-xl border border-tenx-gold/30 rounded-xl p-8 text-center", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-16 h-16 bg-tenx-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-tenx-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-heading font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-white/60 mb-6">{successMessage}</p>
                <GoldButton onClick={() => { setSubmitStatus('idle'); setStep(1); setForm(prev => ({ ...prev, message: '' })); }}>
                    Send Another Message
                </GoldButton>
            </motion.div>
        );
    }

    if (submitStatus === 'exists') {
        return (
            <motion.div className={twMerge("bg-black/60 backdrop-blur-xl border border-tenx-gold/30 rounded-xl p-8 text-center", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-2xl font-heading font-bold text-white mb-2">We already have your details!</h3>
                <p className="text-white/60 mb-6">You are already in our system. Please wait 24 hours for us to get back to you, or email us directly for immediate assistance.</p>
                <a href="mailto:hello@tenxafrica.co.za" className="text-tenx-gold hover:text-white transition-colors underline mb-6 block">hello@tenxafrica.co.za</a>
                <GoldButton onClick={() => { setSubmitStatus('idle'); setStep(1); setForm(prev => ({ ...prev, message: '' })); }}>
                    Back to Form
                </GoldButton>
            </motion.div>
        );
    }

    return (
        <div className={className}>
            {/* Progress Bar */}
            <div className="mb-8 p-1 bg-white/5 rounded-full relative h-2 overflow-hidden">
                <motion.div
                    className="absolute top-0 left-0 h-full bg-tenx-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${(step / totalSteps) * 100}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            <motion.form
                onSubmit={handleSubmit}
                className="bg-black/60 backdrop-blur-xl border border-tenx-gold/30 rounded-xl p-6 md:p-8 min-h-[500px] flex flex-col justify-between"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex-1">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer / Navigation */}
                <div className="mt-8 flex justify-between pt-6 border-t border-white/5">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-6 py-3 text-white/60 hover:text-white transition-colors"
                        >
                            Back
                        </button>
                    ) : <div></div>}

                    {step < totalSteps && (
                        <GoldButton type="button" onClick={handleNext}>
                            Next Step
                        </GoldButton>
                    )}

                    {step === totalSteps && (
                        <GoldButton type="submit" disabled={isSubmitting || !form.turnstileToken}>
                            {isSubmitting ? 'Sending...' : submitText}
                        </GoldButton>
                    )}
                </div>
            </motion.form>
        </div>
    );
};
