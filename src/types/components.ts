/**
 * Component types for various UI elements
 */

export interface OnboardingStep {
    step: number;
    title: string;
    description: string;
}

export interface ImpactProject {
    id: string;
    title: string;
    description: string;
    image: {
        src: string;
        alt: string;
    };
    location: string;
    category: string;
    metrics: Record<string, string | number>;
}

export interface Service {
    id: string;
    title: string;
    description: string;
}

export interface Stat {
    value: string;
    label: string;
    prefix?: string;
    suffix?: string;
}

export interface TeamMember {
    image: any;
    id: string;
    name: string;
    role: string;
    stats?: string;
    bio?: string;
    linkedin?: string;
}

export type ContactInterest = 'consulting' | 'network' | 'catalyst' | 'general';
