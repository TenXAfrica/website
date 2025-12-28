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

// Types
type Stage = 'identity' | 'contact' | 'phone' | 'context' | 'challenge' | 'qualification' | 'security' | 'complete';

interface FormData {
    name: string;
    email: string;
    phone: string;
    company: string;
    website: string;
    hasWebsite: boolean;
    challenge: string;
    budget: string;
    timeline: string;
    turnstileToken?: string;
}

const BUDGET_OPTIONS = [
    '< R50k',
    'R50k - R200k',
    'R200k+',
    'Not sure yet'
];



const TypewriterText: React.FC<{ text: string; onComplete?: () => void }> = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, 30); // Typing speed
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, onComplete]);

    return (
        <span className="font-mono text-tenx-gold/80">
            {displayedText}
            {currentIndex < text.length && <span className="animate-pulse">_</span>}
        </span>
    );
};

export const DigitalConsultingChat: React.FC = () => {
    // State
    const [stage, setStage] = useState<Stage>('identity');
    const [history, setHistory] = useState<Stage[]>([]); // Track completed stages
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
        company: '',
        website: '',
        hasWebsite: true,
        challenge: '',
        budget: '',
        timeline: ''
    });
    const [isTyping, setIsTyping] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // Phone State
    const [country, setCountry] = useState<CountryCode>('ZA');
    const [phoneDisplay, setPhoneDisplay] = useState('');
    const [isCountryOpen, setIsCountryOpen] = useState(false);

    // Refs for scrolling
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isFirstRender = useRef(true);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    // Auto-scroll to bottom when stage changes
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        scrollToBottom();
    }, [stage, isTyping, history]);

    // Helpers
    const advanceStage = (currentStage: Stage) => {
        setHistory([...history, currentStage]);
        setIsTyping(true);
        
        switch (currentStage) {
            case 'identity': setStage('contact'); break;
            case 'contact': setStage('phone'); break;
            case 'phone': setStage('context'); break;
            case 'context': setStage('challenge'); break;
            case 'challenge': setStage('qualification'); break;
            case 'qualification': setStage('security'); break;
            case 'security': setStage('complete'); break;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, currentStage: Stage, isValid: boolean) => {
        if (e.key === 'Enter' && isValid) {
            advanceStage(currentStage);
        }
    };

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


    // Renderers for each stage
    const renderIdentity = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                {isHistory ? 
                    "INITIALIZING PROTOCOL... IDENTIFY THE LEAD ARCHITECT." : 
                    <TypewriterText 
                        text="INITIALIZING PROTOCOL... IDENTIFY THE LEAD ARCHITECT." 
                        onComplete={() => setIsTyping(false)}
                    />
                }
            </div>
            {(!isTyping || isHistory) && (
                <div className="animate-fade-in-up flex items-center gap-3">
                    <span className="text-tenx-gold font-mono">{'>'}</span>
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            onKeyDown={e => handleKeyDown(e, 'identity', !!formData.name.trim())}
                            className={twMerge(
                                "w-full bg-transparent border-0 border-b border-tenx-gold/30 text-white p-2 outline-none font-mono transition-all focus:border-tenx-gold",
                                isHistory ? "border-transparent text-white/50" : ""
                            )}
                            autoFocus={!isHistory}
                        />
                    </div>
                    {!isHistory && formData.name.trim() && (
                        <button onClick={() => advanceStage('identity')} className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors">ENTER ↵</button>
                    )}
                </div>
            )}
        </div>
    );

    const renderContact = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                 {isHistory ? 
                    "ACKNOWLEDGED. WHERE SHOULD WE TRANSMIT THE STRATEGY BRIEFING?" : 
                    <TypewriterText 
                        text="ACKNOWLEDGED. WHERE SHOULD WE TRANSMIT THE STRATEGY BRIEFING?" 
                        onComplete={() => setIsTyping(false)}
                    />
                 }
            </div>
            {(!isTyping || isHistory) && (
                <div className="animate-fade-in-up flex items-center gap-3">
                    <span className="text-tenx-gold font-mono">{'>'}</span>
                    <div className="flex-1">
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            onKeyDown={e => handleKeyDown(e, 'contact', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))}
                            className={twMerge(
                                "w-full bg-transparent border-0 border-b border-tenx-gold/30 text-white p-2 outline-none font-mono transition-all focus:border-tenx-gold",
                                isHistory ? "border-transparent text-white/50" : ""
                            )}
                            autoFocus={!isHistory}
                        />
                    </div>
                    {!isHistory && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                        <button onClick={() => advanceStage('contact')} className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors">ENTER ↵</button>
                    )}
                </div>
            )}
        </div>
    );

    const renderPhone = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                 {isHistory ? 
                    "SECURE VOICE LINE CONFIGURED." : 
                    <TypewriterText 
                        text="REQUIRED FOR SECONDARY AUTHENTICATION PROTOCOL (PHONE)." 
                        onComplete={() => setIsTyping(false)} 
                    />
                 }
            </div>
            {(!isTyping || isHistory) && (
                <div className="animate-fade-in-up space-y-2">
                    <div className="flex items-center gap-3">
                         <span className="text-tenx-gold font-mono">{'>'}</span>
                         <div className="flex-1 flex gap-2 border-b border-tenx-gold/30 focus-within:border-tenx-gold transition-colors items-center relative min-w-0">
                            
                            {/* Custom Country Select */}
                            <div className="relative">
                                <button 
                                    onClick={() => !isHistory && setIsCountryOpen(!isCountryOpen)}
                                    className="flex items-center gap-2 py-2 pl-2 pr-2 outline-none cursor-pointer text-sm font-mono text-white hover:text-tenx-gold transition-colors"
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

                            {/* Click outside listener could be added here or strictly handled via focus/blur if time permitted, but simple toggle for now */}
                            {isCountryOpen && (
                                <div className="fixed inset-0 z-40" onClick={() => setIsCountryOpen(false)} />
                            )}

                            <input
                                type="tel"
                                placeholder="PhoneNumber" 
                                value={phoneDisplay}
                                onChange={e => {
                                    setPhoneDisplay(e.target.value);
                                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                                }}
                                onBlur={handlePhoneBlur}
                                onKeyDown={e => handleKeyDown(e, 'phone', !!formData.phone.trim())}
                                className={twMerge(
                                    "flex-1 bg-transparent border-none text-white p-2 outline-none font-mono", // Added min-w-0
                                    isHistory ? "text-white/50" : ""
                                )}
                                autoFocus={!isHistory}
                            />
                         </div>
                    </div>
                     {!isHistory && formData.phone.trim() && (
                        <div className="flex justify-end pr-2 pt-2">
                            <button onClick={() => advanceStage('phone')} className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors">ENTER ↵</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderContext = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                 {isHistory ? 
                    "MAPPING VENTURE DATA. ENTER COMPANY NAME & URL." : 
                    <TypewriterText 
                        text="MAPPING VENTURE DATA. ENTER COMPANY NAME & URL." 
                        onComplete={() => setIsTyping(false)} 
                    />
                 }
            </div>
            {(!isTyping || isHistory) && (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-3">
                        <span className="text-tenx-gold font-mono">{'>'}</span>
                        <input
                            type="text"
                            placeholder="Company Name"
                            value={formData.company}
                            onChange={e => setFormData({ ...formData, company: e.target.value })}
                            className={twMerge(
                                "w-full bg-transparent border-0 border-b border-tenx-gold/30 text-white p-2 outline-none font-mono transition-all focus:border-tenx-gold",
                                isHistory ? "border-transparent text-white/50" : ""
                            )}
                            autoFocus={!isHistory}
                        />
                    </div>
                    
                    {formData.hasWebsite && (
                        <div className="flex items-center gap-3">
                            <span className="text-tenx-gold font-mono">{'>'}</span>
                            <input
                                type="url"
                                placeholder="https://website.com"
                                value={formData.website}
                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                onKeyDown={e => handleKeyDown(e, 'context', !!formData.company.trim())}
                                className={twMerge(
                                    "w-full bg-transparent border-0 border-b border-tenx-gold/30 text-white p-2 outline-none font-mono transition-all focus:border-tenx-gold",
                                    isHistory ? "border-transparent text-white/50" : ""
                                )}
                            />
                        </div>
                    )}

                    {!isHistory && (
                        <div className="pl-6">
                            <button 
                                onClick={() => setFormData(prev => ({ ...prev, hasWebsite: !prev.hasWebsite, website: '' }))}
                                className="text-xs text-white/40 hover:text-white transition-colors font-mono"
                            >
                                {formData.hasWebsite ? "[ NO WEBSITE? CLASSIFIED ]" : "[ ACTIVATE WEBSITE LINK ]"}
                            </button>
                        </div>
                    )}
                    
                    {!isHistory && formData.company.trim() && (
                        <div className="flex justify-end pr-2">
                             <button onClick={() => advanceStage('context')} className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors">NEXT STEP →</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderChallenge = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                {isHistory ? 
                    "CONTEXT RECEIVED. FUEL THE AI: DESCRIBE THE PROBLEM YOU NEED TO SOLVE." : 
                    <TypewriterText 
                        text="CONTEXT RECEIVED. FUEL THE AI: DESCRIBE THE PROBLEM YOU NEED TO SOLVE." 
                        onComplete={() => setIsTyping(false)} 
                    />
                }
            </div>
            {(!isTyping || isHistory) && (
                <div className="relative animate-fade-in-up flex gap-3">
                    <span className="text-tenx-gold font-mono mt-2">{'>'}</span>
                    <div className="flex-1 group">
                        <textarea
                            placeholder="// Describe your challenge here (min 50 chars)..."
                            value={formData.challenge}
                            onChange={e => setFormData({ ...formData, challenge: e.target.value })}
                            rows={4}
                            className={twMerge(
                                "w-full bg-transparent border-0 border-l mb-2 border-tenx-gold/30 text-white p-2 pl-4 outline-none transition-all font-mono text-sm focus:border-tenx-gold resize-none",
                                isHistory ? "border-white/10 text-white/50" : ""
                            )}
                            autoFocus={!isHistory}
                        />
                        {!isHistory && (
                            <div className="flex justify-between items-center mt-2 pl-4">
                                <div className="text-xs text-white/30 font-mono">
                                    {formData.challenge.length} / 50 CHARS
                                </div>
                                {formData.challenge.length >= 50 && (
                                    <button onClick={() => advanceStage('challenge')} className="text-tenx-gold text-xs font-mono tracking-widest hover:text-white transition-colors">NEXT STEP →</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderQualification = (isHistory: boolean) => (
        <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
             <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                {isHistory ? 
                    "FINALIZING TELEMETRY. DEFINE THE MISSION SCOPE." : 
                    <TypewriterText 
                        text="FINALIZING TELEMETRY. DEFINE THE MISSION SCOPE." 
                        onComplete={() => setIsTyping(false)} 
                    />
                }
            </div>
            {(!isTyping || isHistory) && (
                <div className="flex flex-wrap gap-4 animate-fade-in-up">
                    {BUDGET_OPTIONS.map(opt => (
                        <button
                            key={opt}
                            onClick={() => {
                                setFormData({ ...formData, budget: opt });
                                setTimeout(() => advanceStage('qualification'), 300);
                            }}
                            className={twMerge(
                                "px-6 py-4 rounded-lg border transition-all text-sm font-medium",
                                formData.budget === opt
                                    ? "bg-tenx-gold text-black border-tenx-gold shadow-[0_0_15px_rgba(214,134,20,0.4)]"
                                    : "bg-black/40 border-white/10 text-white hover:border-tenx-gold/50"
                            )}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        
         try {
            const webhookUrl = import.meta.env.PUBLIC_CONTACT_WEBHOOK_URL;
            const payload = { 
                ...formData, 
                submittedAt: new Date().toISOString(),
                source: "digital-consulting-terminal"
            };

            if (!webhookUrl) {
                console.warn('PUBLIC_CONTACT_WEBHOOK_URL not set. Simulating.');
                await new Promise(r => setTimeout(r, 1500));
            } else {
                 const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                
                if (!response.ok) throw new Error('Transmission failed');
            }
            
            setSubmitStatus('success');
            setStage('complete');

        } catch (err) {
             setSubmitStatus('error');
             setErrorMessage('TRANSMISSION_FAILED. RETRY?');
             setIsSubmitting(false);
        }
    };

    const renderSecurity = (isHistory: boolean) => (
         <div className={twMerge("mb-12", isHistory && "opacity-50 pointer-events-none")}>
            <div className="font-sys text-tenx-gold tracking-widest text-sm mb-4">
                 {isHistory ? 
                    "CONFIRMING HUMAN PROTOCOL..." : 
                    <TypewriterText 
                        text="CONFIRMING HUMAN PROTOCOL..." 
                        onComplete={() => setIsTyping(false)} 
                    />
                 }
            </div>
            
            {(!isTyping || isHistory) && (
                <div className="animate-fade-in-up">
                    {!isHistory && (
                        <div className="bg-black/40 p-3 sm:p-6 rounded-lg border border-white/10 w-full flex justify-center overflow-hidden">
                            <div className="scale-[0.85] sm:scale-100 origin-center">
                                <Turnstile
                                    sitekey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                                    onVerify={(token) => setFormData(prev => ({ ...prev, turnstileToken: token }))}
                                    theme="dark"
                                />
                            </div>
                        </div>
                    )}

                    {!isHistory && formData.turnstileToken && (
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

    const renderSuccess = () => (
         <div className="text-center py-20 animate-fade-in-up">
            <div className="w-20 h-20 bg-tenx-gold/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-tenx-gold/50 shadow-[0_0_30px_rgba(214,134,20,0.2)]">
                <svg className="w-10 h-10 text-tenx-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-heading font-bold text-white mb-4">TRANSMISSION RECEIVED</h2>
            <p className="text-white/60 max-w-md mx-auto mb-8 leading-relaxed">
                The Ten X Engine has logged your request. Our architects will analyze the data and establish a secure uplink within 24 hours.
            </p>
            <a href="/" className="text-tenx-gold hover:text-white transition-colors text-sm font-mono tracking-widest uppercase border-b border-tenx-gold/30 hover:border-white pb-1">
                Return to Base
            </a>
        </div>
    );

    // Calculate Progress
    const getProgress = () => {
        const stages: Stage[] = ['identity', 'contact', 'context', 'challenge', 'qualification', 'security', 'complete'];
        const currentIdx = stages.indexOf(stage);
        return ((currentIdx) / (stages.length - 1)) * 100;
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
                    href="/digital-consulting" 
                    className="pointer-events-auto group flex items-center gap-2 px-4 py-2 rounded-full border border-tenx-gold/30 bg-black/40 backdrop-blur-sm text-tenx-gold text-xs font-mono tracking-widest uppercase hover:bg-tenx-gold hover:text-black hover:border-tenx-gold transition-all"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    <span>Back</span>
                </a>
                <div className="font-mono text-[10px] text-white/30 tracking-[0.2em] hidden sm:block pt-2">
                    SECURE_UPLINK_V4.2
                </div>
            </header>

            {/* Chat Flow */}
            <div className="pt-20"> {/* added padding for fixed header */}
                <GlassCard className="w-full min-h-[700px] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border-tenx-gold/20 bg-black/5 backdrop-blur-lg">
                    <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin scrollbar-thumb-tenx-gold/20 scrollbar-track-transparent">
                        {(history.includes('identity') || stage === 'identity') && renderIdentity(stage !== 'identity')}
                        {(history.includes('contact') || stage === 'contact') && renderContact(stage !== 'contact')}
                        {(history.includes('phone') || stage === 'phone') && renderPhone(stage !== 'phone')}
                        {(history.includes('context') || stage === 'context') && renderContext(stage !== 'context')}
                        {(history.includes('challenge') || stage === 'challenge') && renderChallenge(stage !== 'challenge')}
                        {(history.includes('qualification') || stage === 'qualification') && renderQualification(stage !== 'qualification')}
                        {(history.includes('security') || stage === 'security') && renderSecurity(stage !== 'security')}
                        <div ref={messagesEndRef} />
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};
