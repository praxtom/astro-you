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
