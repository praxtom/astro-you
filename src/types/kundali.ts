/**
 * Kundali (Birth Chart) type definitions
 */

export interface PlanetaryPosition {
    name: string;
    sign: string;
    signCode?: string;
    degree: number;
    house: number;
    is_retrograde: boolean;
    speed?: number;
    nakshatra?: string;
    nakshatraPada?: number;
}

export interface HouseCusp {
    house: number;
    sign: string;
    signCode?: string;
    degree: number;
}

export interface KundaliData {
    planetary_positions: PlanetaryPosition[];
    house_cusps: HouseCusp[];
    ascendant?: {
        sign: string;
        signCode?: string;
        degree: number;
    };
    calculatedAt?: Date;
}

export interface DashaPeriod {
    planet: string;
    planetName: string;  // Sanskrit name
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    yearsRemaining?: number;
    subPeriods?: DashaPeriod[];
}

export interface DashaData {
    currentMahadasha: DashaPeriod;
    currentAntardasha?: DashaPeriod;
    upcomingPeriods: DashaPeriod[];
}

export interface Yoga {
    name: string;
    sanskritName?: string;
    description: string;
    isAuspicious: boolean;
    strength?: 'weak' | 'moderate' | 'strong';
    planets: string[];
}

export interface NavamsaData {
    planetary_positions: PlanetaryPosition[];
    house_cusps: HouseCusp[];
}

export interface TransitData {
    date: string;
    positions: PlanetaryPosition[];
    significantEvents?: TransitEvent[];
}

export interface TransitEvent {
    type: 'conjunction' | 'aspect' | 'ingress' | 'retrograde' | 'direct';
    planets: string[];
    description: string;
    date: string;
    significance: 'low' | 'medium' | 'high';
}

export interface PanchangData {
    date: string;
    tithi: {
        name: string;
        endTime: string;
    };
    nakshatra: {
        name: string;
        endTime: string;
    };
    yoga: {
        name: string;
        endTime: string;
    };
    karana: {
        name: string;
        endTime: string;
    };
    rahuKaal: {
        start: string;
        end: string;
    };
    sunrise: string;
    sunset: string;
    moonSign: string;
    sunSign: string;
}
