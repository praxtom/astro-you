/**
 * Component Prop Type Definitions
 * Contains all reusable component prop interfaces
 */

import type { ReactNode } from 'react';

// Dashboard Components
export interface FeatureCardProps {
    title: string;
    description: string;
    icon: ReactNode;
    status: 'Active' | 'Beta' | 'Coming Soon' | null;
    onClick?: () => void;
    accentColor: string;
}

// Landing Page Components
export interface InfluenceCardProps {
    number: string;
    title: string;
    description: string;
    theme: string;
    isActive: boolean;
    align?: 'left' | 'right' | 'center';
}

// Onboarding Components
export interface ParsedChartData {
    chartStyle?: 'North Indian' | 'South Indian';
    ascendant?: { sign: string; house: number };
    planets?: Array<{ name: string; sign: string; house: number }>;
    yogas?: string[];
    birthDetails?: {
        dob?: string;
        tob?: string;
        pob?: string;
    };
    confidence?: number;
}
