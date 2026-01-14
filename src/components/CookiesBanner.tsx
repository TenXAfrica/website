import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const CookiesBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already accepted cookies
        const cookiesAccepted = localStorage.getItem('cookiesAccepted');
        if (!cookiesAccepted) {
            // Show banner after a short delay for better UX
            setTimeout(() => setIsVisible(true), 1000);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookiesAccepted', 'true');
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookiesAccepted', 'false');
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="fixed bottom-6 left-6 right-6 z-50 md:left-auto md:right-6 md:max-w-md"
                >
                    <div className="relative overflow-hidden rounded-xl bg-black/80 backdrop-blur-xl border border-tenx-gold/40 shadow-2xl">
                        {/* Glossy overlay effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                        
                        {/* Gold accent line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tenx-gold/50 via-tenx-gold to-tenx-gold/50" />

                        <div className="relative p-6">
                            <div className="flex items-start gap-3 mb-4">
                                {/* Cookie Icon */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-tenx-gold/20 flex items-center justify-center">
                                    <svg 
                                        className="w-5 h-5 text-tenx-gold" 
                                        viewBox="0 0 299.049 299.049" 
                                        fill="currentColor"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <g>
                                            <path d="M289.181,206.929c-13.5-12.186-18.511-31.366-12.453-48.699c1.453-4.159-0.94-8.686-5.203-9.82
                                                c-27.77-7.387-41.757-38.568-28.893-64.201c2.254-4.492-0.419-9.898-5.348-10.837c-26.521-5.069-42.914-32.288-34.734-58.251
                                                c1.284-4.074-1.059-8.414-5.178-9.57C184.243,1.867,170.626,0,156.893,0C74.445,0,7.368,67.076,7.368,149.524
                                                s67.076,149.524,149.524,149.524c57.835,0,109.142-33.056,133.998-83.129C292.4,212.879,291.701,209.204,289.181,206.929z
                                                M156.893,283.899c-74.095,0-134.374-60.281-134.374-134.374S82.799,15.15,156.893,15.15c9.897,0,19.726,1.078,29.311,3.21
                                                c-5.123,29.433,11.948,57.781,39.41,67.502c-9.727,29.867,5.251,62.735,34.745,74.752c-4.104,19.27,1.49,39.104,14.46,53.365
                                                C251.758,256.098,207.229,283.899,156.893,283.899z"/>
                                            <path d="M76.388,154.997c-13.068,0-23.7,10.631-23.7,23.701c0,13.067,10.631,23.7,23.7,23.7c13.067,0,23.7-10.631,23.7-23.7
                                                C100.087,165.628,89.456,154.997,76.388,154.997z M76.388,187.247c-4.715,0-8.55-3.835-8.55-8.55s3.835-8.551,8.55-8.551
                                                c4.714,0,8.55,3.836,8.55,8.551S81.102,187.247,76.388,187.247z"/>
                                            <path d="M173.224,90.655c0-14.9-12.121-27.021-27.02-27.021s-27.021,12.121-27.021,27.021c0,14.898,12.121,27.02,27.021,27.02
                                                C161.104,117.674,173.224,105.553,173.224,90.655z M134.334,90.655c0-6.545,5.325-11.871,11.871-11.871
                                                c6.546,0,11.87,5.325,11.87,11.871s-5.325,11.87-11.87,11.87S134.334,97.199,134.334,90.655z"/>
                                            <path d="M169.638,187.247c-19.634,0-35.609,15.974-35.609,35.61c0,19.635,15.974,35.61,35.609,35.61
                                                c19.635,0,35.61-15.974,35.61-35.61C205.247,203.221,189.273,187.247,169.638,187.247z M169.638,243.315
                                                c-11.281,0-20.458-9.178-20.458-20.46s9.178-20.46,20.458-20.46c11.281,0,20.46,9.178,20.46,20.46
                                                S180.92,243.315,169.638,243.315z"/>
                                        </g>
                                    </svg>
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-heading font-bold text-white text-lg mb-2">
                                        Cookie Notice
                                    </h3>
                                    <p className="text-vapor-white/70 text-sm leading-relaxed">
                                        We use cookies and analytics to improve your experience on our site and understand how you interact with our content. By continuing, you agree to our use of cookies.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleAccept}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-tenx-gold hover:bg-tenx-gold/90 text-obsidian-void font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-tenx-gold/30"
                                >
                                    Accept
                                </button>
                                <button
                                    onClick={handleDecline}
                                    className="px-4 py-2.5 rounded-lg border border-vapor-white/30 hover:border-vapor-white/50 text-vapor-white/90 font-semibold text-sm transition-all duration-200"
                                >
                                    Decline
                                </button>
                            </div>

                            {/* Link to privacy policy */}
                            <div className="mt-3 text-center">
                                <a 
                                    href="/privacy" 
                                    className="text-xs text-tenx-gold/80 hover:text-tenx-gold underline-offset-2 hover:underline transition-colors"
                                >
                                    Learn more in our Privacy Policy
                                </a>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
