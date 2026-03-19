/**
 * Component Prop Type Definitions
 * Contains all reusable component prop interfaces
 */

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
