import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface NavItem {
    label: string;
    href: string;
}

interface NavigationProps {
    navLinks: NavItem[];
    cta: NavItem;
    /** Current pathname, passed from the layout so server and client agree. */
    currentPath?: string;
}

const isActive = (href: string, currentPath: string) =>
    href === '/' ? currentPath === '/' : currentPath === href || currentPath.startsWith(`${href}/`);

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile navigation (below 1024px). A toggle button plus a full-screen,
 * opaque obsidian sheet: 56px link rows, a 44px close target, focus
 * trapped inside while open and returned to the toggle on close.
 * No blur, no slide animation, no dropdowns (design contract section 6).
 */
export const Navigation: React.FC<NavigationProps> = ({ navLinks, cta, currentPath = '' }) => {
    const [open, setOpen] = useState(false);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    const close = useCallback(() => {
        setOpen(false);
        // Restore focus to the control that opened the sheet.
        requestAnimationFrame(() => toggleRef.current?.focus());
    }, []);

    // Lock page scroll, move focus in, and trap Tab / handle Escape.
    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab' || !sheetRef.current) return;

            const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, close]);

    // Close if the viewport grows past the mobile breakpoint.
    useEffect(() => {
        if (!open) return;
        const mq = window.matchMedia('(min-width: 1024px)');
        const onChange = (e: MediaQueryListEvent) => {
            if (e.matches) setOpen(false);
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [open]);

    return (
        <>
            <button
                ref={toggleRef}
                type="button"
                onClick={() => setOpen(true)}
                className="lg:hidden inline-flex h-11 w-11 items-center justify-center text-vapor-white transition-colors duration-150 hover:text-tenx-gold"
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="mobile-menu"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="square" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
            </button>

            {open && (
                <div
                    ref={sheetRef}
                    id="mobile-menu"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Site menu"
                    className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-obsidian-void lg:hidden"
                >
                    <div className="container-content flex h-20 shrink-0 items-center justify-between border-b border-rule">
                        <span className="t-label">Menu</span>
                        <button
                            ref={closeRef}
                            type="button"
                            onClick={close}
                            className="inline-flex h-11 w-11 items-center justify-center text-vapor-white transition-colors duration-150 hover:text-tenx-gold"
                            aria-label="Close menu"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path strokeLinecap="square" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </div>

                    <nav aria-label="Main" className="container-content flex-1 py-4">
                        <ul>
                            {navLinks.map((link) => {
                                const active = isActive(link.href, currentPath);
                                return (
                                    <li key={link.href} className="border-b border-rule">
                                        <a
                                            href={link.href}
                                            onClick={() => setOpen(false)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex min-h-14 items-center font-heading text-xl font-semibold transition-colors duration-150 hover:text-tenx-gold ${
                                                active ? 'text-tenx-gold' : 'text-vapor-white'
                                            }`}
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div
                        className="container-content shrink-0 border-t border-rule pt-4"
                        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                    >
                        <a href={cta.href} onClick={() => setOpen(false)} className="btn btn-primary w-full">
                            {cta.label}
                        </a>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navigation;
