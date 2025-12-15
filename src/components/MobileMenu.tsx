import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Consulting', href: '/consulting' },
    { label: 'Catalyst', href: '/catalyst' },
    { label: 'Impact', href: '/impact' },
    { label: 'Network', href: '/network' },
    { label: 'Insights', href: '/insights' },
    { label: 'Contact', href: '/contact' },
];

/**
 * Mobile navigation menu rendered as a portal for full-screen coverage.
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
    const [mounted, setMounted] = useState(false);
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    useEffect(() => {
        setMounted(true);
    }, []);

    const isActive = (href: string) => {
        if (href === '/') {
            return currentPath === '/';
        }
        return currentPath.startsWith(href);
    };

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!mounted) return null;

    const menuContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex flex-col"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#0a0f14',
                        zIndex: 9999,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between p-6 border-b border-white/10"
                        style={{ backgroundColor: '#0a0f14' }}
                    >
                        <span className="text-lg font-heading font-bold text-white">Menu</span>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            aria-label="Close menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Nav Links */}
                    <nav
                        className="flex-1 px-6 py-8 overflow-y-auto"
                        style={{ backgroundColor: '#0a0f14' }}
                    >
                        <ul className="space-y-2">
                            {navLinks.map((link, index) => (
                                <motion.li
                                    key={link.href}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <a
                                        href={link.href}
                                        className={`block py-3 px-4 text-lg rounded-lg transition-colors ${isActive(link.href)
                                            ? 'text-tenx-gold bg-tenx-gold/10 font-medium'
                                            : 'text-white/80 hover:text-tenx-gold hover:bg-white/5'
                                            }`}
                                        onClick={onClose}
                                    >
                                        {link.label}
                                    </a>
                                </motion.li>
                            ))}
                        </ul>
                    </nav>

                    {/* CTA */}
                    <div
                        className="p-6 border-t border-white/10"
                        style={{ backgroundColor: '#0a0f14' }}
                    >
                        <a
                            href="/contact?interest=network"
                            className="block w-full py-3 px-6 text-center bg-tenx-gold text-black font-bold uppercase tracking-wider text-sm rounded-lg hover:bg-tenx-gold/90 transition-colors"
                            onClick={onClose}
                        >
                            Join Network
                        </a>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // Render to body using portal
    return createPortal(menuContent, document.body);
};

/**
 * Mobile menu toggle button with hamburger animation.
 */
interface MenuToggleProps {
    isOpen: boolean;
    onClick: () => void;
}

export const MenuToggle: React.FC<MenuToggleProps> = ({ isOpen, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="lg:hidden w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
            </svg>
        </button>
    );
};

/**
 * Navigation wrapper component that handles mobile menu state.
 */
export const Navigation: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <MenuToggle isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
};

