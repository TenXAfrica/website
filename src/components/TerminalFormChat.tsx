import React, { useState, useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import Turnstile from 'react-turnstile';
import { GoldButton } from './GoldButton';
import { GlassCard } from './GlassCard';
import {
    getCountries,
    getCountryCallingCode,
    parsePhoneNumber,
    formatPhoneNumberIntl
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import en from 'react-phone-number-input/locale/en.json';
import type { CountryCode } from 'libphonenumber-js';

// Types from content collection
interface FieldOption {
    value: string;
    label: string;
}

interface FormField {
    name: string;
    type: 'text' | 'email' | 'phone' | 'url' | 'textarea' | 'radio' | 'select' | 'file';
    placeholder?: string;
    label?: string;
    required?: boolean;
    minLength?: number;
    options?: FieldOption[];
    toggleLabel?: string;
    // File-specific options
    accept?: string; // e.g. "application/pdf,image/*"
    multiple?: boolean; // allow multiple file selection
    maxSizeMB?: number; // per-file size cap
    helperText?: string; // helper copy under the control
}

interface FormStage {
    id: string;
    prompt: string;
    historyLabel: string;
    fields?: FormField[];
    advanceButton?: {
        label?: string;
        showOnMobile?: boolean;
    };
}

interface SuccessConfig {
    headline: string;
    message: string;
    ctaLabel?: string;
    ctaHref?: string;
}

interface TerminalFormConfig {
    slug: string;
    title: string;
    description?: string;
    webhookUrl: string;
    emailCheckWebhookUrl?: string;
    trackingParams?: string[];
    errorMessages?: {
        invalidCaptcha?: string;
        processingError?: string;
        generic?: string;
    };
    requireTurnstile?: boolean;
    backButtonHref?: string;
    backButtonLabel?: string;
    theme?: {
        versionTag?: string;
    };
    stages: FormStage[];
    success: SuccessConfig;
}

interface TerminalFormChatProps {
    config: TerminalFormConfig;
}

// Typewriter effect component with LLM-style chunked streaming
const TypewriterText: React.FC<{ text: string; onComplete?: () => void; className?: string }> = ({ text, onComplete, className }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            // Generate random chunk size between 2-6 characters (avg ~4)
            const chunkSize = Math.floor(Math.random() * 5) + 2;
            // Variable delay between 40-80ms for more natural feel
            const delay = Math.floor(Math.random() * 40) + 40;
            
            const timeout = setTimeout(() => {
                const remainingChars = text.length - currentIndex;
                const actualChunkSize = Math.min(chunkSize, remainingChars);
                const chunk = text.slice(currentIndex, currentIndex + actualChunkSize);
                
                setDisplayedText(prev => prev + chunk);
                setCurrentIndex(prev => prev + actualChunkSize);
            }, delay);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, onComplete]);

    return (
        <span className={twMerge("font-mono text-tenx-gold/80", className)}>
            {displayedText}
            {currentIndex < text.length && <span className="animate-pulse">_</span>}
        </span>
    );
};

export const TerminalFormChat: React.FC<TerminalFormChatProps> = ({ config }) => {
    // State
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [history, setHistory] = useState<number[]>([]);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [trackingData, setTrackingData] = useState<Record<string, string>>({});
    const [emailCheckMessage, setEmailCheckMessage] = useState('');
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [isTyping, setIsTyping] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Phone-specific state
    const [country, setCountry] = useState<CountryCode>('ZA');
    const [phoneDisplay, setPhoneDisplay] = useState('');
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    
    // Toggle states for optional fields
    const [toggledFields, setToggledFields] = useState<Record<string, boolean>>({});
    // Files selected per field
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
    const [fileErrors, setFileErrors] = useState<Record<string, string | undefined>>({});
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isFirstRender = useRef(true);

    const currentStage = config.stages[currentStageIndex];
    const isComplete = currentStageIndex >= config.stages.length;

    // Helpers for files
    const getFieldByName = (name: string): FormField | undefined => {
        for (const stage of config.stages) {
            const found = stage.fields?.find(f => f.name === name);
            if (found) return found;
        }
        return undefined;
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Capture tracking params from URL once on mount
    useEffect(() => {
        const keys = config.trackingParams && config.trackingParams.length > 0
            ? config.trackingParams
            : ['token', 'utm_source', 'utm_medium', 'utm_campaign'];
        const params = new URLSearchParams(window.location.search);
        const collected: Record<string, string> = {};
        const prefilled: Record<string, string> = {};
        
        // Collect tracking params (separate from form data)
        keys.forEach(key => {
            const value = params.get(key);
            if (value) collected[key] = value;
        });
        
        // Only prefill actual form fields (not tracking params)
        const allFieldNames = config.stages
            .flatMap(stage => stage.fields || [])
            .map(field => field.name);
        
        allFieldNames.forEach(fieldName => {
            const value = params.get(fieldName);
            if (value) prefilled[fieldName] = value;
        });
        
        setTrackingData(collected);
        if (Object.keys(prefilled).length > 0) {
            setFormData(prev => ({ ...prev, ...prefilled }));
        }
    }, [config.trackingParams, config.stages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    // Normalize a website/url to bare domain (e.g., https://www.example.com/path -> example.com)
    const normalizeWebsite = (value: string): string => {
        const trimmed = (value || '').trim();
        if (!trimmed) return '';
        const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        try {
            const url = new URL(prefixed);
            const hostname = url.hostname.replace(/^www\./i, '');
            return hostname || '';
        } catch {
            // Fallback: strip protocol/www and path heuristically
            return trimmed
                .replace(/^https?:\/\/?/i, '')
                .replace(/^www\./i, '')
                .split('/')[0];
        }
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        scrollToBottom();
    }, [currentStageIndex, isTyping, history]);

    // Helper: Advance to next stage
    const advanceStage = async () => {
        // Email duplication guard
        const emailField = currentStage?.fields?.find(f => f.type === 'email');
        if (emailField && config.emailCheckWebhookUrl) {
            const email = (formData[emailField.name] || '').trim();
            if (email) {
                setIsCheckingEmail(true);
                setEmailCheckMessage('');
                try {
                    const response = await fetch(config.emailCheckWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                    });
                    const result = await response.json();
                    
                    if (result.exists) {
                        const name = result.name || 'this contact';
                        setEmailCheckMessage(`We already have ${name} on file. Reach us directly at hello@tenxafrica.co.za to continue.`);
                        setIsCheckingEmail(false);
                        return;
                    }
                } catch (err) {
                    console.warn('Email check failed:', err);
                    // Continue anyway on error
                } finally {
                    setIsCheckingEmail(false);
                }
            }
            setEmailCheckMessage('');
        }

        setHistory([...history, currentStageIndex]);
        setIsTyping(true);
        setCurrentStageIndex(prev => prev + 1);
    };

    // Helper: Check if current stage is valid
    const isStageValid = (): boolean => {
        if (isCheckingEmail) return false; // Block during email check
        
        if (!currentStage?.fields || currentStage.fields.length === 0) {
            return true; // Stages without fields (like security) are always valid
        }

        return currentStage.fields.every(field => {
            // If field is toggled off, skip validation
            if (toggledFields[field.name]) return true;
            
            const value = formData[field.name] || '';
            
            // For non-required fields, empty is valid but non-empty must be validated
            if (!field.required && !value.trim()) return true;
            
            if (field.type === 'email') {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            }
            if (field.type === 'url') {
                // If empty and not required, already returned true above
                // Otherwise validate URL format - must have valid domain with TLD
                if (!value.trim()) return false;
                
                // Helper to validate URL structure
                const isValidUrl = (str: string): boolean => {
                    try {
                        const url = new URL(str);
                        // Must have a valid hostname with at least one dot (e.g., example.com)
                        return url.hostname.includes('.');
                    } catch {
                        return false;
                    }
                };
                
                // Try as-is first, then with https:// prefix
                if (isValidUrl(value)) return true;
                if (isValidUrl(`https://${value}`)) return true;
                return false;
            }
            if (field.type === 'phone') {
                // Validate phone number using parsePhoneNumber
                if (!value.trim()) return false;
                const phoneNumber = parsePhoneNumber(phoneDisplay || value, country);
                return phoneNumber?.isValid() ?? false;
            }
            if (field.type === 'textarea' && field.minLength) {
                return value.length >= field.minLength;
            }
            if (field.type === 'file') {
                const files = uploadedFiles[field.name] || [];
                if (!field.required && files.length === 0) return true;
                if (field.required && files.length === 0) return false;
                const maxSizeMB = field.maxSizeMB ?? 10; // default 10MB per file
                const maxBytes = maxSizeMB * 1024 * 1024;
                // All files must be within size, and if accept is provided, must match types
                const accepted = (mime: string): boolean => {
                    if (!field.accept) return true;
                    return field.accept.split(',').map(s => s.trim()).some(mask => {
                        if (mask.endsWith('/*')) {
                            const prefix = mask.replace('/*','');
                            return mime.startsWith(prefix);
                        }
                        return mime === mask || mask === '*/*';
                    });
                };
                return files.every(f => f.size <= maxBytes && accepted(f.type));
            }
            return value.trim().length > 0;
        });
    };

    // Handle key down for Enter submission
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isStageValid()) {
            advanceStage();
        }
    };

    // Handle phone blur for formatting
    const handlePhoneBlur = () => {
        if (!phoneDisplay) return;
        const phoneNumber = parsePhoneNumber(phoneDisplay, country);
        if (phoneNumber) {
            setPhoneDisplay(formatPhoneNumberIntl(phoneNumber.number) || phoneDisplay);
            setFormData(prev => ({ ...prev, phone: phoneNumber.number as string }));
        } else {
            setFormData(prev => ({ ...prev, phone: phoneDisplay }));
        }
    };

    // Handle phone Enter key - format before advancing
    const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && phoneDisplay.trim()) {
            // Format phone number before advancing
            const phoneNumber = parsePhoneNumber(phoneDisplay, country);
            if (phoneNumber) {
                setPhoneDisplay(formatPhoneNumberIntl(phoneNumber.number) || phoneDisplay);
                setFormData(prev => ({ ...prev, phone: phoneNumber.number as string }));
            } else {
                setFormData(prev => ({ ...prev, phone: phoneDisplay }));
            }
            advanceStage();
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        
        try {
            const webhookUrl = config.webhookUrl?.trim();
            if (!webhookUrl) {
                setSubmitStatus('error');
                setErrorMessage('WEBHOOK_NOT_CONFIGURED');
                setIsSubmitting(false);
                return;
            }
            
            // Build clean payload with no duplicates - separate form data from metadata
            // Ensure `website` is explicitly sent as empty string when not provided
            const sanitizedFormData: Record<string, string> = { ...formData };
            const hasWebsiteField = config.stages.some(s => s.fields?.some(f => f.name === 'website'));
            if (hasWebsiteField) {
                const isWebsiteToggledOff = Boolean(toggledFields['website']);
                const currentWebsite = sanitizedFormData['website'] || '';
                sanitizedFormData['website'] = isWebsiteToggledOff ? '' : normalizeWebsite(currentWebsite);
            }

            const payload: any = {
                formData: sanitizedFormData,
                metadata: {
                    submittedAt: new Date().toISOString(),
                    source: `terminal-form-${config.slug}`,
                    turnstileToken: formData.turnstileToken
                }
            };

            // Attach files (convert to base64 up to size cap)
            const allFiles: { field: string; files: File[] }[] = Object.keys(uploadedFiles).map(name => ({ field: name, files: uploadedFiles[name] || [] }));
            if (allFiles.some(entry => entry.files.length)) {
                const attachments: any[] = [];
                for (const entry of allFiles) {
                    const fdef = getFieldByName(entry.field);
                    const maxSizeMB = fdef?.maxSizeMB ?? 10;
                    const maxBytes = maxSizeMB * 1024 * 1024;
                    for (const f of entry.files) {
                        const includeContent = f.size <= maxBytes && f.size <= 5 * 1024 * 1024; // hard safety cap 5MB for console/loggers
                        let base64: string | undefined = undefined;
                        if (includeContent) {
                            try {
                                base64 = await fileToBase64(f);
                            } catch {}
                        }
                        attachments.push({
                            field: entry.field,
                            name: f.name,
                            size: f.size,
                            type: f.type,
                            contentBase64: base64,
                            contentIncluded: Boolean(base64)
                        });
                    }
                }
                if (attachments.length) payload.attachments = attachments;
            }
            
            // Only include tracking if we have it
            if (Object.keys(trackingData).length > 0) {
                payload.tracking = trackingData;
            }
            
            // Remove turnstileToken from formData since it's in metadata
            delete payload.formData.turnstileToken;

            console.log('=== TERMINAL FORM SUBMISSION ===');
            console.log('Webhook URL:', webhookUrl);
            console.log('Payload:', payload);
            console.log('================================');

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            let result: any = null;
            try {
                result = await response.json();
            } catch {
                // ignore JSON parse issues
            }

            const status = result?.status;
            const message = result?.message;

            if (!response.ok || status === 'error') {
                const msgKey = message === 'Invalid Captcha'
                    ? 'invalidCaptcha'
                    : message === 'Lead processing error'
                        ? 'processingError'
                        : 'generic';
                const configured = config.errorMessages?.[msgKey];
                const fallback = message || 'TRANSMISSION_FAILED. RETRY?';
                throw new Error(configured || fallback);
            }
            
            setSubmitStatus('success');

        } catch (err: any) {
            setSubmitStatus('error');
            setErrorMessage(err?.message || 'TRANSMISSION_FAILED. RETRY?');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render a single field
    const renderField = (field: FormField, isHistory: boolean, fieldIndex: number) => {
        const isToggled = toggledFields[field.name];
        const shouldAutoFocus = !isHistory && fieldIndex === 0; // Only first field gets autoFocus
        
        switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
                if (isToggled) return null;
                return (
                    <div key={field.name} className="flex items-center gap-3">
                        <span className="text-tenx-gold font-mono">{'>'}</span>
                        <input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={formData[field.name] || ''}
                            onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className={twMerge(
                                "w-full bg-transparent border-0 border-b border-tenx-gold/30 text-white p-2 outline-none font-mono transition-all focus:border-tenx-gold",
                                isHistory ? "border-transparent text-white/50" : ""
                            )}
                            autoFocus={shouldAutoFocus}
                            disabled={isHistory}
                        />
                    </div>
                );

            case 'phone':
                return (
                    <div key={field.name} className="flex items-center gap-3">
                        <span className="text-tenx-gold font-mono">{'>'}</span>
                        <div className="flex-1 flex gap-2 border-b border-tenx-gold/30 focus-within:border-tenx-gold transition-colors items-center relative min-w-0">
                            {/* Country Select */}
                            <div className="relative">
                                <button 
                                    onClick={() => !isHistory && setIsCountryOpen(!isCountryOpen)}
                                    className="flex items-center gap-2 py-2 pl-2 pr-2 outline-none cursor-pointer text-sm font-mono text-white hover:text-tenx-gold transition-colors whitespace-nowrap"
                                    type="button"
                                >
                                    <img 
                                        src={`https://flagcdn.com/w20/${country.toLowerCase()}.png`}
                                        srcSet={`https://flagcdn.com/w40/${country.toLowerCase()}.png 2x`}
                                        width="20" 
                                        height="15" 
                                        alt={country}
                                        className="rounded-sm opacity-80"
                                    />
                                    <span>+{getCountryCallingCode(country)}</span>
                                    <span className="text-[10px] text-tenx-gold/50 ml-1">▼</span>
                                </button>

                                {/* Dropdown Menu */}
                                {isCountryOpen && !isHistory && (
                                    <div className="absolute top-full left-0 mt-2 w-64 max-h-60 overflow-y-auto bg-black/90 backdrop-blur-xl border border-tenx-gold/30 rounded-lg shadow-xl z-50 scrollbar-thin scrollbar-thumb-tenx-gold/20 scrollbar-track-transparent">
                                        {getCountries().map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => {
                                                    setCountry(c);
                                                    setIsCountryOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-tenx-gold/20 text-left transition-colors"
                                            >
                                                <img 
                                                    src={`https://flagcdn.com/w20/${c.toLowerCase()}.png`}
                                                    width="20" 
                                                    height="15" 
                                                    alt={c}
                                                    className="rounded-sm"
                                                />
                                                <span className="text-white font-mono text-xs flex-1">{en[c]}</span>
                                                <span className="text-tenx-gold font-mono text-xs">+{getCountryCallingCode(c)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {isCountryOpen && (
                                <div className="fixed inset-0 z-40" onClick={() => setIsCountryOpen(false)} />
                            )}

                            <input
                                type="tel"
                                placeholder={field.placeholder}
                                value={phoneDisplay}
                                onChange={e => {
                                    setPhoneDisplay(e.target.value);
                                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                                }}
                                onBlur={handlePhoneBlur}
                                onKeyDown={handlePhoneKeyDown}
                                className={twMerge(
                                    "flex-1 bg-transparent border-none text-white p-2 outline-none font-mono min-w-0 w-full",
                                    isHistory ? "text-white/50" : ""
                                )}
                                autoFocus={shouldAutoFocus}
                                disabled={isHistory}
                            />
                        </div>
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.name} className="relative flex gap-3">
                        <span className="text-tenx-gold font-mono mt-2">{'>'}</span>
                        <div className="flex-1 group">
                            <textarea
                                placeholder={field.placeholder}
                                value={formData[field.name] || ''}
                                onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                                rows={4}
                                className={twMerge(
                                    "w-full bg-transparent border-0 border-l mb-2 border-tenx-gold/30 text-white p-2 pl-4 outline-none transition-all font-mono text-sm focus:border-tenx-gold resize-none",
                                    isHistory ? "border-white/10 text-white/50" : ""
                                )}
                                autoFocus={shouldAutoFocus}
                                disabled={isHistory}
                            />
                            {!isHistory && field.minLength && (
                                <div className="text-xs text-white/30 font-mono pl-4">
                                    {(formData[field.name] || '').length} / {field.minLength} CHARS
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'file':
                if (isToggled) return null;
                return (
                    <div key={field.name} className="flex items-start gap-3">
                        <span className="text-tenx-gold font-mono">{'>'}</span>
                        <div className="flex-1">
                            <input
                                id={`file-${field.name}`}
                                type="file"
                                className="hidden"
                                multiple={field.multiple}
                                accept={field.accept || 'application/pdf,.pdf'}
                                disabled={isHistory}
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    const fdef = getFieldByName(field.name);
                                    const maxSizeMB = fdef?.maxSizeMB ?? 10;
                                    const maxBytes = maxSizeMB * 1024 * 1024;
                                    const acceptMask = (fdef?.accept || 'application/pdf,.pdf').split(',').map(s => s.trim());
                                    const accept = (file: File) => {
                                        const mime = file.type || '';
                                        const ext = file.name.toLowerCase().split('.').pop();
                                        return acceptMask.some(mask => {
                                            if (mask === '.pdf') return ext === 'pdf';
                                            if (mask.endsWith('/*')) {
                                                const prefix = mask.replace('/*','');
                                                return mime.startsWith(prefix);
                                            }
                                            return mime === mask || mask === '*/*';
                                        });
                                    };
                                    let invalidType = 0, tooBig = 0;
                                    const valid = files.filter(f => {
                                        const okType = accept(f);
                                        const okSize = f.size <= maxBytes;
                                        if (!okType) invalidType++;
                                        if (!okSize) tooBig++;
                                        return okType && okSize;
                                    });
                                    setUploadedFiles(prev => ({ ...prev, [field.name]: valid }));
                                    if (files.length === 0) {
                                        setFileErrors(prev => ({ ...prev, [field.name]: undefined }));
                                    } else if (valid.length === 0) {
                                        const msg = invalidType > 0
                                            ? `Unsupported file type. Please attach a PDF.`
                                            : `File too large. Max ${maxSizeMB}MB.`;
                                        setFileErrors(prev => ({ ...prev, [field.name]: msg }));
                                    } else {
                                        const notes: string[] = [];
                                        if (invalidType > 0) notes.push(`${invalidType} file(s) ignored (type)`);
                                        if (tooBig > 0) notes.push(`${tooBig} file(s) ignored (size)`);
                                        setFileErrors(prev => ({ ...prev, [field.name]: notes.length ? notes.join(', ') : undefined }));
                                    }
                                }}
                            />
                            <div className={twMerge(
                                "w-full bg-black/40 border border-tenx-gold/30 rounded px-3 py-3 font-mono text-sm",
                                isHistory ? "border-white/10 text-white/50" : "hover:border-tenx-gold/50"
                            )}>
                                <label htmlFor={`file-${field.name}`} className={twMerge(
                                    "inline-flex items-center gap-2 px-3 py-2 rounded border border-tenx-gold/30 text-tenx-gold cursor-pointer hover:bg-tenx-gold/10 transition-colors",
                                    isHistory ? "pointer-events-none opacity-60" : ""
                                )}>
                                    <span>+ Attach File{field.multiple ? 's' : ''}</span>
                                </label>
                                {field.helperText && (
                                    <div className="text-white/40 text-xs mt-2">{field.helperText}</div>
                                )}
                                <div className="mt-3 space-y-1">
                                    {(uploadedFiles[field.name] || []).map((f, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-white/80">
                                            <span className="truncate mr-3">{f.name}</span>
                                            <span className="text-white/40 text-xs">{(f.size/1024/1024).toFixed(2)} MB</span>
                                        </div>
                                    ))}
                                    {!uploadedFiles[field.name]?.length && (
                                        <div className="text-white/40 text-xs">No file selected</div>
                                    )}
                                    {fileErrors[field.name] && (
                                        <div className="text-red-400 text-xs">{fileErrors[field.name]}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'radio':
                return (
                    <div key={field.name} className="flex flex-wrap gap-4">
                        {field.options?.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setFormData({ ...formData, [field.name]: opt.value });
                                    setTimeout(advanceStage, 300);
                                }}
                                className={twMerge(
                                    "px-6 py-4 rounded-lg border transition-all text-sm font-medium",
                                    formData[field.name] === opt.value
                                        ? "bg-tenx-gold text-black border-tenx-gold shadow-[0_0_15px_rgba(214,134,20,0.4)]"
                                        : "bg-black/40 border-white/10 text-white hover:border-tenx-gold/50"
                                )}
                                disabled={isHistory}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                );

            case 'select':
                if (isToggled) return null;
                return (
                    <div key={field.name} className="flex items-center gap-3">
                        <span className="text-tenx-gold font-mono">{'>'}</span>
                        <select
                            value={formData[field.name] || ''}
                            onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className={twMerge(
                                "w-full bg-black/40 border border-tenx-gold/30 text-white p-2 rounded outline-none font-mono transition-all focus:border-tenx-gold focus:bg-black/60",
                                isHistory ? "border-white/10 text-white/50 cursor-not-allowed" : "cursor-pointer hover:border-tenx-gold/50"
                            )}
                            autoFocus={shouldAutoFocus}
                            disabled={isHistory}
                        >
                            <option value="" disabled>
                                {field.placeholder || 'Select an option'}
                            </option>
                            {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                );

            default:
                return null;
        }
    };

    // Render a complete stage
    const renderStage = (stageIndex: number, isHistory: boolean) => {
        const stage = config.stages[stageIndex];
        if (!stage) return null;

        const hasRadioField = stage.fields?.some(f => f.type === 'radio');
        const showAdvanceButton = !hasRadioField && stage.advanceButton && isStageValid() && !isHistory;

        return (
            <div key={stage.id} className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
                <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                    {isHistory ? 
                        stage.historyLabel : 
                        <TypewriterText 
                            text={stage.prompt} 
                            onComplete={() => setIsTyping(false)} 
                        />
                    }
                </div>
                
                {(!isTyping || isHistory) && (
                    <div className="space-y-4 animate-fade-in-up">
                        {stage.fields?.map((field, fieldIndex) => (
                            <React.Fragment key={field.name}>
                                {renderField(field, isHistory, fieldIndex)}
                                {field.toggleLabel && !isHistory && (
                                    <div className="pl-6">
                                        <button 
                                            onClick={() => setToggledFields(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                                            className="text-xs text-white/40 hover:text-white transition-colors font-mono"
                                        >
                                            {toggledFields[field.name] ? "[ ACTIVATE FIELD ]" : field.toggleLabel}
                                        </button>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}

                        {stage.fields?.some(f => f.type === 'email') && emailCheckMessage && !isHistory && (
                            <div className="pl-6 text-sm font-mono">
                                <TypewriterText text={emailCheckMessage} className="text-red-400" />
                            </div>
                        )}
                        
                        {showAdvanceButton && (
                            <div className="flex justify-end pr-2 pt-2">
                                <button 
                                    onClick={advanceStage} 
                                    className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors"
                                >
                                    {stage.advanceButton?.label || 'ENTER ↵'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Render security stage (Turnstile)
    const renderSecurityStage = (isHistory: boolean) => {
        if (!config.requireTurnstile) return null;
        
        const securityStage = config.stages.find(s => s.id === 'security');
        if (!securityStage) return null;

        const stageIndex = config.stages.findIndex(s => s.id === 'security');
        const isCurrentOrHistory = currentStageIndex === stageIndex || history.includes(stageIndex);
        
        if (!isCurrentOrHistory) return null;
        const isActualHistory = currentStageIndex !== stageIndex;

        return (
            <div className={twMerge("mb-12", isActualHistory && "opacity-50 pointer-events-none")}>
                <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                    {isActualHistory ? 
                        securityStage.historyLabel : 
                        <TypewriterText 
                            text={securityStage.prompt} 
                            onComplete={() => setIsTyping(false)} 
                        />
                    }
                </div>
                
                {(!isTyping || isActualHistory) && (
                    <div className="animate-fade-in-up">
                        {!isActualHistory && (
                            <div className="bg-black/40 p-3 sm:p-6 rounded-lg border border-white/10 w-full flex justify-center overflow-hidden">
                                <div className="scale-[0.85] sm:scale-100 origin-center">
                                    <Turnstile
                                        sitekey={(import.meta as any).env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                                        onVerify={(token) => setFormData(prev => ({ ...prev, turnstileToken: token }))}
                                        theme="dark"
                                    />
                                </div>
                            </div>
                        )}

                        {!isActualHistory && formData.turnstileToken && (
                            <div className="mt-8">
                                <GoldButton 
                                    onClick={handleSubmit} 
                                    disabled={isSubmitting}
                                    className="w-full md:w-auto"
                                >
                                    {isSubmitting ? "TRANSMITTING..." : "INITIATE TRANSMISSION"}
                                </GoldButton>
                                {errorMessage && <p className="text-red-500 text-xs mt-3 font-mono">{errorMessage}</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Render success screen
    const renderSuccess = () => (
        <div className="text-center py-20 animate-fade-in-up">
            <div className="w-20 h-20 bg-tenx-gold/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-tenx-gold/50 shadow-[0_0_30px_rgba(214,134,20,0.2)]">
                <svg className="w-10 h-10 text-tenx-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h2 className="text-3xl font-heading font-bold text-white mb-4">{config.success.headline}</h2>
            <p className="text-white/60 max-w-md mx-auto mb-8 leading-relaxed">
                {config.success.message}
            </p>
            <a href={config.success.ctaHref} className="text-tenx-gold hover:text-white transition-colors text-sm font-mono tracking-widest uppercase border-b border-tenx-gold/30 hover:border-white pb-1">
                {config.success.ctaLabel}
            </a>
        </div>
    );

    // Calculate progress
    const getProgress = () => {
        return (currentStageIndex / config.stages.length) * 100;
    };

    if (submitStatus === 'success') {
        return <div className="max-w-2xl mx-auto px-6 min-h-screen flex items-center justify-center">{renderSuccess()}</div>;
    }

    return (
        <div className="max-w-3xl w-full mx-auto px-6 py-20 pb-40">
            {/* Telemetry Bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50">
                <div 
                    className="h-full bg-tenx-gold shadow-[0_0_10px_rgba(214,134,20,0.5)] transition-all duration-700 ease-out"
                    style={{ width: `${getProgress()}%` }}
                />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-start z-40 pointer-events-none">
                <a 
                    href={config.backButtonHref} 
                    className="pointer-events-auto group flex items-center gap-2 px-4 py-2 rounded-full border border-tenx-gold/30 bg-black/40 backdrop-blur-sm text-tenx-gold text-xs font-mono tracking-widest uppercase hover:bg-tenx-gold hover:text-black hover:border-tenx-gold transition-all"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    <span>{config.backButtonLabel}</span>
                </a>
                {config.theme?.versionTag && (
                    <div className="font-mono text-[10px] text-white/30 tracking-[0.2em] hidden sm:block pt-2">
                        {config.theme.versionTag}
                    </div>
                )}
            </header>

            {/* Chat Flow */}
            <div className="pt-20">
                <GlassCard className="w-full min-h-[700px] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border-tenx-gold/20 bg-black/5 backdrop-blur-lg">
                    <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin scrollbar-thumb-tenx-gold/20 scrollbar-track-transparent">
                        {/* Render completed stages from history */}
                        {history.map(stageIdx => {
                            const stage = config.stages[stageIdx];
                            if (stage.id === 'security') return null; // Security handled separately
                            return renderStage(stageIdx, true);
                        })}
                        
                        {/* Render current stage */}
                        {!isComplete && currentStage.id !== 'security' && renderStage(currentStageIndex, false)}
                        
                        {/* Render security stage if applicable */}
                        {renderSecurityStage(false)}
                        
                        <div ref={messagesEndRef} />
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};
