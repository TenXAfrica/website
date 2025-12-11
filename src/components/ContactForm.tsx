import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { GoldButton } from './GoldButton';
import type { ContactInterest } from '../types/components';

interface ContactFormProps {
    interests: {
        value: ContactInterest;
        label: string;
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
    phone: string;
    company: string;
    interest: ContactInterest;
    message: string;
}

/**
 * Contact form with interest router dropdown.
 * Client-side validation and form handling.
 */
export const ContactForm: React.FC<ContactFormProps> = ({
    interests,
    submitText = 'Send Message',
    successMessage = "We'll get back to you within 24-48 hours.",
    errorMessage = 'Something went wrong. Please try again or email us directly.',
    placeholders = {
        name: 'Your full name',
        email: 'you@company.com',
        phone: '+27 XX XXX XXXX',
        company: 'Your organization',
        message: 'Tell us about your needs...',
    },
    className,
    defaultInterest = 'general',
}) => {
    const [form, setForm] = useState<FormState>({
        name: '',
        email: '',
        phone: '',
        company: '',
        interest: defaultInterest as ContactInterest,
        message: '',
    });

    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof FormState, string>> = {};

        if (!form.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!form.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!form.message.trim()) {
            newErrors.message = 'Message is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSubmitting(true);

        // Simulate API call - replace with actual endpoint in production
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log('Form submitted:', form);
        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name as keyof FormState]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    if (isSubmitted) {
        return (
            <motion.div
                className={twMerge(
                    'bg-black/60 backdrop-blur-xl border border-tenx-gold/30 rounded-xl p-8 text-center',
                    className
                )}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="w-16 h-16 bg-tenx-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-tenx-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-2xl font-heading font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-white/60">{successMessage}</p>
            </motion.div>
        );
    }

    const inputClasses = 'w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:border-tenx-gold/50 focus:outline-none focus:ring-1 focus:ring-tenx-gold/50 transition-colors';
    const labelClasses = 'block text-sm font-medium text-white/80 mb-2';
    const errorClasses = 'text-xs text-red-400 mt-1';

    return (
        <motion.form
            onSubmit={handleSubmit}
            className={twMerge(
                'bg-black/60 backdrop-blur-xl border border-tenx-gold/30 rounded-xl p-6 md:p-8',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="grid md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                    <label htmlFor="name" className={labelClasses}>
                        Name <span className="text-tenx-gold">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder={placeholders.name}
                        className={twMerge(inputClasses, errors.name && 'border-red-400')}
                    />
                    {errors.name && <p className={errorClasses}>{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                    <label htmlFor="email" className={labelClasses}>
                        Email <span className="text-tenx-gold">*</span>
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder={placeholders.email}
                        className={twMerge(inputClasses, errors.email && 'border-red-400')}
                    />
                    {errors.email && <p className={errorClasses}>{errors.email}</p>}
                </div>

                {/* Phone */}
                <div>
                    <label htmlFor="phone" className={labelClasses}>
                        Phone
                    </label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder={placeholders.phone}
                        className={inputClasses}
                    />
                </div>

                {/* Company */}
                <div>
                    <label htmlFor="company" className={labelClasses}>
                        Company
                    </label>
                    <input
                        type="text"
                        id="company"
                        name="company"
                        value={form.company}
                        onChange={handleChange}
                        placeholder={placeholders.company}
                        className={inputClasses}
                    />
                </div>

                {/* Interest Router */}
                <div className="md:col-span-2">
                    <label htmlFor="interest" className={labelClasses}>
                        I am interested in... <span className="text-tenx-gold">*</span>
                    </label>
                    <select
                        id="interest"
                        name="interest"
                        value={form.interest as string}
                        onChange={handleChange}
                        className={twMerge(inputClasses, 'cursor-pointer')}
                    >
                        {interests.map(({ value, label }) => (
                            <option key={value as string} value={value as string} className="bg-obsidian-void">
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Message */}
                <div className="md:col-span-2">
                    <label htmlFor="message" className={labelClasses}>
                        Message <span className="text-tenx-gold">*</span>
                    </label>
                    <textarea
                        id="message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        placeholder={placeholders.message}
                        rows={5}
                        className={twMerge(inputClasses, 'resize-none', errors.message && 'border-red-400')}
                    />
                    {errors.message && <p className={errorClasses}>{errors.message}</p>}
                </div>
            </div>

            {/* Submit */}
            <div className="mt-8">
                <GoldButton
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto"
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending...
                        </span>
                    ) : (
                        submitText
                    )}
                </GoldButton>
            </div>
        </motion.form>
    );
};
