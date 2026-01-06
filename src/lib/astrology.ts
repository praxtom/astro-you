/**
 * Astrology Utility Library for AstroYou
 */

export const ZODIAC_SIGNS = [
    { id: 1, name: 'Mesha', western: 'Aries', code: 'Ari' },
    { id: 2, name: 'Vrishabha', western: 'Taurus', code: 'Tau' },
    { id: 3, name: 'Mithuna', western: 'Gemini', code: 'Gem' },
    { id: 4, name: 'Karka', western: 'Cancer', code: 'Can' },
    { id: 5, name: 'Simha', western: 'Leo', code: 'Leo' },
    { id: 6, name: 'Kanya', western: 'Virgo', code: 'Vir' },
    { id: 7, name: 'Tula', western: 'Libra', code: 'Lib' },
    { id: 8, name: 'Vrishchika', western: 'Scorpio', code: 'Sco' },
    { id: 9, name: 'Dhanu', western: 'Sagittarius', code: 'Sag' },
    { id: 10, name: 'Makara', western: 'Capricorn', code: 'Cap' },
    { id: 11, name: 'Kumbha', western: 'Aquarius', code: 'Aqu' },
    { id: 12, name: 'Meena', western: 'Pisces', code: 'Pis' },
];

export const PLANETS = {
    'Sun': { name: 'Surya', symbol: 'Su', color: '#FFD700' },
    'Moon': { name: 'Chandra', symbol: 'Mo', color: '#E2E8F0' },
    'Mars': { name: 'Mangal', symbol: 'Ma', color: '#F87171' },
    'Mercury': { name: 'Budha', symbol: 'Me', color: '#60A5FA' },
    'Jupiter': { name: 'Guru', symbol: 'Ju', color: '#FBBF24' },
    'Venus': { name: 'Shukra', symbol: 'Ve', color: '#F472B6' },
    'Saturn': { name: 'Shani', symbol: 'Sa', color: '#94A3B8' },
    'Mean_Node': { name: 'Rahu', symbol: 'Ra', color: '#A78BFA' },
    'Mean_South_Node': { name: 'Ketu', symbol: 'Ke', color: '#6366F1' },
    'True_Node': { name: 'Rahu', symbol: 'Ra', color: '#A78BFA' },
    'True_South_Node': { name: 'Ketu', symbol: 'Ke', color: '#6366F1' },
    'Uranus': { name: 'Uranus', symbol: 'Ur', color: '#2DD4BF' },
    'Neptune': { name: 'Neptune', symbol: 'Ne', color: '#818CF8' },
    'Pluto': { name: 'Pluto', symbol: 'Pl', color: '#9CA3AF' },
    'Ascendant': { name: 'Lagna', symbol: 'Asc', color: '#FFFFFF' },
};

/**
 * Get sign name from code (e.g., 'Ari' -> 'Mesha')
 */
export function getSignByCode(code: string) {
    return ZODIAC_SIGNS.find(s => s.code === code);
}

/**
 * Get sign number from code (e.g., 'Ari' -> 1)
 */
export function getSignNumberByCode(code: string) {
    return ZODIAC_SIGNS.find(s => s.code === code)?.id || 1;
}

/**
 * Calculate sign numbers for all 12 houses based on Ascendant sign number
 */
export function calculateHouseSigns(ascendantSignNumber: number): number[] {
    const signs = [];
    for (let i = 0; i < 12; i++) {
        let sign = (ascendantSignNumber + i) % 12;
        if (sign === 0) sign = 12;
        signs.push(sign);
    }
    return signs;
}

/**
 * Interface for API response data
 */
export interface PlanetaryPosition {
    name: string;
    sign: string;
    degree: number;
    house: number;
    is_retrograde: boolean;
    speed?: number;
    nakshatra?: string;
}

export interface KundaliData {
    planetary_positions: PlanetaryPosition[];
    house_cusps: Array<{
        house: number;
        sign: string;
        degree: number;
    }>;
}
