import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
    label: string;
    href: string;
    children?: {
        label: string;
        href: string;
    }[];
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    navLinks: NavItem[];
    onGetStartedClick?: () => void;
}

/**
 * Mobile navigation menu rendered as a portal for full-screen coverage.
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, navLinks, onGetStartedClick }) => {
    const [mounted, setMounted] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    useEffect(() => {
        setMounted(true);
    }, []);

    const isLinkActive = (item: NavItem) => {
        if (!item.href) return false;
        if (item.href === '/') {
            return currentPath === '/';
        }
        const selfActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));
        const childActive = item.children?.some(child => currentPath === child.href);
        return !!(selfActive || childActive);
    };

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
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
                    initial={{ opacity: 0, x: '100%' }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-50 lg:hidden flex flex-col bg-obsidian-void"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 mt-2 border-b border-white/5">
                        <span className="text-xl font-bold tracking-tight text-white">Menu</span>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/60 hover:text-white transition-colors"
                            aria-label="Close menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-8">
                        <div className="container px-6 flex flex-col space-y-2">
                            {navLinks.map((link, index) => {
                                const hasChildren = link.children && link.children.length > 0;
                                const isExpanded = expandedItems.includes(link.label);
                                const active = isLinkActive(link);

                                return (
                                    <motion.div
                                        key={link.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <div className="flex flex-col">
                                            {hasChildren ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleExpand(link.label);
                                                    }}
                                                    className={`flex items-center justify-between w-full py-3 px-4 text-lg rounded-lg transition-colors ${active
                                                        ? 'text-tenx-gold bg-tenx-gold/10 font-bold'
                                                        : 'text-white/80 hover:text-tenx-gold hover:bg-white/5'
                                                        }`}
                                                >
                                                    <span>{link.label}</span>
                                                    <svg
                                                        className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <a
                                                    href={link.href}
                                                    className={`block py-3 px-4 text-lg rounded-lg transition-colors ${active
                                                        ? 'text-tenx-gold bg-tenx-gold/10 font-bold'
                                                        : 'text-white/80 hover:text-tenx-gold hover:bg-white/5'
                                                        }`}
                                                    onClick={onClose}
                                                >
                                                    {link.label}
                                                </a>
                                            )}

                                            {/* Submenu */}
                                            {hasChildren && (
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                            className="overflow-hidden bg-white/5 mx-4 mt-1 rounded-lg"
                                                        >
                                                            <div className="py-2 flex flex-col">
                                                                {link.children?.map((child) => (
                                                                    <a
                                                                        key={child.label}
                                                                        href={child.href}
                                                                        className={`py-3 px-6 text-base transition-colors ${currentPath === child.href
                                                                            ? 'text-tenx-gold font-medium'
                                                                            : 'text-white/60 hover:text-tenx-gold'
                                                                            }`}
                                                                        onClick={onClose}
                                                                    >
                                                                        {child.label}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </nav>

                    {/* CTA */}
                    <div
                        className="p-4 sm:p-6 border-t border-white/10 space-y-3"
                        style={{ backgroundColor: '#0a0f14' }}
                    >
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('openGetStartedModal'));
                                onClose();
                            }}
                            className="block w-full py-3 px-6 text-center border border-white/20 text-white font-bold uppercase tracking-wider text-sm rounded-lg hover:border-tenx-gold hover:text-tenx-gold transition-all active:scale-95"
                        >
                            Get Started
                        </button>
                        <a
                            href="/coming-soon"
                            className="block w-full py-3 px-6 text-center bg-tenx-gold text-black font-bold uppercase tracking-wider text-sm rounded-lg hover:bg-tenx-gold/90 transition-all active:scale-95 shadow-lg shadow-tenx-gold/20"
                            onClick={onClose}
                        >
                            Login
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
interface NavigationProps {
    navLinks: NavItem[];
    onGetStartedClick?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ navLinks, onGetStartedClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <MenuToggle isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} navLinks={navLinks} onGetStartedClick={onGetStartedClick} />
        </>
    );
};

