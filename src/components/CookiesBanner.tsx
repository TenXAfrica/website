import React, { useEffect, useState } from 'react';

/**
 * Cookie notice. A flat bottom bar on surface-1 with a hairline top border.
 * No blur, no pill, no slide animation. The stored choice is unchanged.
 */
export const CookiesBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let accepted: string | null = null;
        try {
            accepted = localStorage.getItem('cookiesAccepted');
        } catch {
            accepted = null;
        }
        if (!accepted) {
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const store = (value: 'true' | 'false') => {
        try {
            localStorage.setItem('cookiesAccepted', value);
        } catch {
            /* storage blocked: just hide for this page view */
        }
        const w = window as unknown as { gtag?: (...args: unknown[]) => void };
        w.gtag?.('consent', 'update', {
            analytics_storage: value === 'true' ? 'granted' : 'denied',
        });
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div
            role="region"
            aria-label="Cookie notice"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-surface-1 print:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="container-wide flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <p className="t-small max-w-[44rem]">
                    We use cookies and Google Analytics to see which pages are read, so we can improve them.{' '}
                    <a
                        href="/privacy"
                        className="text-vapor-white underline underline-offset-4 transition-colors duration-150 hover:text-tenx-gold"
                    >
                        Read the privacy policy
                    </a>
                    .
                </p>
                <div className="flex shrink-0 gap-3">
                    <button type="button" onClick={() => store('true')} className="btn btn-primary">
                        Accept
                    </button>
                    <button type="button" onClick={() => store('false')} className="btn btn-secondary">
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookiesBanner;
