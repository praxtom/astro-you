/**
 * Horoscope type definitions
 */

export interface HoroscopeData {
    type: 'daily' | 'weekly' | 'monthly';
    content: string;
    generatedAt: Date;
    moonSign: string;
    sunSign?: string;
    highlights?: string[];
    luckyNumber?: number;
    luckyColor?: string;
    auspiciousTime?: string;
}

export interface DailyHoroscope extends HoroscopeData {
    type: 'daily';
    date: string;
    mood: 'excellent' | 'good' | 'neutral' | 'challenging';
    focusArea: string;
}

export interface WeeklyHoroscope extends HoroscopeData {
    type: 'weekly';
    weekStart: string;
    weekEnd: string;
    career: string;
    love: string;
    health: string;
    finance: string;
}

export interface MonthlyHoroscope extends HoroscopeData {
    type: 'monthly';
    month: string;
    year: number;
    career: string;
    love: string;
    health: string;
    finance: string;
    spirituality: string;
    keyDates: Array<{
        date: string;
        description: string;
        type: 'auspicious' | 'challenging' | 'neutral';
    }>;
}

// High-Precision Forecast Types (from /horoscope/personal/daily endpoint)

export interface LifeArea {
    area: string;
    title: string;
    prediction: string;
    rating: number;
    keywords: string[];
    reasoning?: string;
}

export interface PlanetaryInfluence {
    planet: string;
    aspect_type: string;
    description: string;
    strength: number;
    natal_planet?: string;
    aspect_name?: string;
    orb?: number;
    reasoning?: string;
}

export interface LuckyElements {
    colors: string[];
    numbers: number[];
    stones: string[];
    directions: string[];
    times: string[];
}

export interface MoonData {
    phase: string;
    sign: string;
    prediction: string;
    illumination: number;
}

export interface ForecastData {
    horoscope: {
        date: string;
        overall_theme: string;
        overall_rating: number;
        life_areas: LifeArea[];
        planetary_influences: PlanetaryInfluence[];
        lucky_elements: LuckyElements;
        moon?: MoonData;
        tips: string[];
    };
    narrative?: string;
    dasha: {
        mahadasha: string;
        bhukti: string;
        ends: string;
    };
}
