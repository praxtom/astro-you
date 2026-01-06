/**
 * Astrology API Service - Centralized wrapper for all Astrology-API.io calls
 * This prevents code duplication across multiple functions
 */

export interface BirthData {
    name?: string;
    dob: string;  // YYYY-MM-DD
    tob: string;  // HH:MM
    pob: string;  // Place of birth (city name)
    lat?: number;
    lng?: number;
}

export interface PlanetaryPosition {
    name: string;
    sign: string;
    signCode: string;
    degree: number;
    house: number;
    is_retrograde: boolean;
    speed?: number;
    nakshatra?: string;
}

export interface HouseCusp {
    house: number;
    sign: string;
    degree: number;
}

export interface KundaliData {
    planetary_positions: PlanetaryPosition[];
    house_cusps: HouseCusp[];
    ascendant?: {
        sign: string;
        degree: number;
    };
}

export interface DashaPeriod {
    planet: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    subPeriods?: DashaPeriod[];
}

export interface TransitData {
    date: string;
    positions: PlanetaryPosition[];
    significantEvents?: string[];
}

const API_BASE = "https://api.astrology-api.io/api/v3";

/**
 * Get API key from environment (optional - API may not require it)
 */
function getApiKey(): string | undefined {
    return process.env.ASTROLOGY_API_KEY;
}

/**
 * Build headers for API requests
 */
function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    const apiKey = getApiKey();
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }

    return headers;
}

/**
 * Parse birth data into API payload format
 */
function parseBirthData(birthData: BirthData) {
    const [year, month, day] = birthData.dob.split("-").map(Number);
    const [hour, minute] = birthData.tob.split(":").map(Number);

    return {
        subject: {
            name: birthData.name || "User",
            birth_data: {
                year,
                month,
                day,
                hour,
                minute,
                city: birthData.pob || "Mumbai",
                latitude: birthData.lat,
                longitude: birthData.lng,
            },
        },
        options: {
            house_system: "W",  // Whole Sign (Vedic)
            zodiac_type: "Sidereal",
            active_points: [
                "Sun", "Moon", "Mercury", "Venus", "Mars",
                "Jupiter", "Saturn", "Mean_Node", "Mean_South_Node", "Ascendant"
            ],
            precision: 2,
        },
    };
}

/**
 * Transform API response to our KundaliData format
 */
function transformKundaliResponse(apiResponse: any): KundaliData {
    const planetary_positions: PlanetaryPosition[] = [];
    const house_cusps: HouseCusp[] = [];

    // The API returns planet data directly in subject_data
    const data = apiResponse.subject_data || apiResponse.data || apiResponse;

    // List of planets to extract - covering all possible API variations
    const planetKeys = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'mean_node', 'true_node', 'mean_south_node', 'ketu', 'rahu'];

    // Possible structures for planetary data
    const planetsSource = data.planets || data.subject_data || data;

    for (const key of planetKeys) {
        // Try direct key (e.g. data.sun) or indexed key (e.g. data.planets.sun)
        const planetData = planetsSource[key] || data[key];

        if (planetData && (planetData.sign || planetData.zodiac_sign)) {
            planetary_positions.push({
                name: planetData.name || key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
                sign: planetData.sign || planetData.zodiac_sign || "",
                signCode: planetData.sign || planetData.zodiac_sign || "",
                degree: planetData.position || planetData.degree || 0,
                house: parseHouseNumber(planetData.house) || 1,
                is_retrograde: planetData.retrograde || planetData.is_retrograde || false,
                speed: planetData.speed,
                nakshatra: planetData.nakshatra,
            });
        }
    }

    // Extract house cusps if available
    if (data.houses) {
        for (const [houseNum, houseData] of Object.entries(data.houses) as any) {
            house_cusps.push({
                house: parseInt(houseNum),
                sign: houseData.sign || "",
                degree: houseData.degree || 0,
            });
        }
    }

    // Extract ascendant - it may also be in subject_data
    let ascendant = null;
    if (data.ascendant) {
        ascendant = {
            sign: data.ascendant.sign || data.ascendant,
            degree: data.ascendant.position || data.ascendant.degree || 0,
        };
    } else if (data.first_house) {
        ascendant = {
            sign: data.first_house.sign || "",
            degree: data.first_house.position || 0,
        };
    }


    return {
        planetary_positions,
        house_cusps,
        ascendant: ascendant || undefined,
    };
}

/**
 * Parse house name to number
 */
function parseHouseNumber(houseName: string | number | undefined): number {
    if (typeof houseName === 'number') return houseName;
    if (!houseName) return 1;

    const houseMap: Record<string, number> = {
        'First_House': 1, 'Second_House': 2, 'Third_House': 3, 'Fourth_House': 4,
        'Fifth_House': 5, 'Sixth_House': 6, 'Seventh_House': 7, 'Eighth_House': 8,
        'Ninth_House': 9, 'Tenth_House': 10, 'Eleventh_House': 11, 'Twelfth_House': 12,
    };

    return houseMap[houseName] || parseInt(houseName) || 1;
}

/**
 * Fetch natal chart (Kundali) from Astrology API
 */
export async function getNatalChart(birthData: BirthData): Promise<KundaliData> {
    const payload = parseBirthData(birthData);

    const response = await fetch(`${API_BASE}/charts/natal`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Astrology API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const transformed = transformKundaliResponse(data);

    return transformed;
}

/**
 * Fetch current planetary transits
 */
export async function getCurrentTransits(): Promise<TransitData> {
    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(`${API_BASE}/transits/current`, {
        method: "GET",
        headers: getHeaders(),
    });

    if (!response.ok) {
        // Fall back to calculating for current date if endpoint doesn't exist
        console.log("Current transits endpoint not available, using natal endpoint");
        return {
            date: today,
            positions: [],
            significantEvents: [],
        };
    }

    const data = await response.json();
    return {
        date: today,
        positions: data.positions || [],
        significantEvents: data.events || [],
    };
}

/**
 * Fetch Dasha periods for a birth chart
 */
export async function getDashaPeriods(birthData: BirthData): Promise<DashaPeriod[]> {
    const payload = parseBirthData(birthData);

    const response = await fetch(`${API_BASE}/dashas/vimshottari`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.log("Dasha endpoint not available");
        return [];
    }

    const data = await response.json();
    return data.periods || [];
}

/**
 * Fetch Navamsa (D9) chart
 */
export async function getNavamsaChart(birthData: BirthData): Promise<KundaliData> {
    const basePayload = parseBirthData(birthData);

    // Try both standard varga endpoint and natal with varga option
    const payload = {
        ...basePayload,
        options: {
            ...basePayload.options,
            varga: "D9",
            chart_type: "D9",
        },
    };

    try {
        const response = await fetch(`${API_BASE}/charts/divisional`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // Fallback: Some versions use /charts/natal with varga option
            const fallbackResponse = await fetch(`${API_BASE}/charts/natal`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload),
            });

            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                return transformKundaliResponse(data);
            }

            throw new Error("Navamsa chart could not be generated");
        }

        const data = await response.json();
        return transformKundaliResponse(data);
    } catch (err) {
        console.error("Navamsa error:", err);
        return { planetary_positions: [], house_cusps: [] };
    }
}

/**
 * Fetch transit chart (Transit overlay on Natal)
 */
export async function getTransitChart(birthData: BirthData, transitDate?: string): Promise<any> {
    const basePayload = parseBirthData(birthData);
    const now = new Date();
    const dateStr = transitDate || now.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    const payload = {
        ...basePayload,
        transit_time: {
            datetime: {
                year: y,
                month: m,
                day: d,
                hour: now.getUTCHours(),
                minute: now.getUTCMinutes(),
                second: 0,
                city: birthData.pob || "Mumbai",
                latitude: birthData.lat,
                longitude: birthData.lng,
            }
        }
    };

    const response = await fetch(`${API_BASE}/charts/transit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Transit API error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Fetch natal transit report (Predictions based on current transits)
 */
export async function getTransitReport(birthData: BirthData, transitDate?: string): Promise<any[]> {
    const basePayload = parseBirthData(birthData);
    const now = new Date();
    const dateStr = transitDate || now.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    const payload = {
        ...basePayload,
        transit_time: {
            datetime: {
                year: y,
                month: m,
                day: d,
                hour: now.getUTCHours(),
                minute: now.getUTCMinutes(),
                second: 0,
                city: birthData.pob || "Mumbai",
                latitude: birthData.lat,
                longitude: birthData.lng,
            }
        }
    };

    const response = await fetch(`${API_BASE}/analysis/natal-transit-report`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.warn("Transit report API error:", response.status);
        return [];
    }

    const result = await response.json();
    console.log("[TransitReport] Raw API response keys:", Object.keys(result));
    console.log("[TransitReport] data keys:", result.data ? Object.keys(result.data) : 'none');

    // Handle deeply nested structure: result.data.report.events
    const data = result.data || result;
    const events = data.report?.events || data.events || result.report?.events || result.events || [];
    console.log(`[TransitReport] Found ${events.length} events`);
    return events;
}

/**
 * Fetch a pre-rendered transit chart image/svg
 */
export async function getRenderedTransitChart(birthData: BirthData, transitDate?: string): Promise<string> {
    const basePayload = parseBirthData(birthData);
    const now = new Date();
    const dateStr = transitDate || now.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    const payload = {
        ...basePayload,
        transit_time: {
            datetime: {
                year: y,
                month: m,
                day: d,
                hour: now.getUTCHours(),
                minute: now.getUTCMinutes(),
                second: 0,
                city: birthData.pob || "Mumbai",
                latitude: birthData.lat,
                longitude: birthData.lng,
            }
        },
        render_options: {
            format: "svg",
            theme: "dark"
        }
    };

    const response = await fetch(`${API_BASE}/render/transit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Transit render API error: ${response.status}`);
    }

    const result = await response.json();
    return result.url || result.data || "";
}

/**
 * Fetch high-precision personal daily horoscope
 */
export async function getDailyHoroscope(birthData: BirthData, date?: string): Promise<any> {
    const basePayload = parseBirthData(birthData);
    const now = new Date();
    const dateStr = date || now.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    const payload = {
        ...basePayload,
        prediction_time: {
            datetime: {
                year: y,
                month: m,
                day: d,
                hour: now.getUTCHours(),
                minute: now.getUTCMinutes(),
                second: 0,
                city: birthData.pob || "Mumbai",
                latitude: birthData.lat,
                longitude: birthData.lng,
            }
        },
        horoscope_type: "daily",
        language: "en",
        tradition: "universal",
        include_transits: true,
        include_progressions: false,
        options: {
            ...basePayload.options,
            language: "en"
        }
    };

    const response = await fetch(`${API_BASE}/horoscope/personal/daily`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.warn("High-precision Horoscope API error:", response.status);
        // Fallback to text version if JSON one fails or isn't available
        try {
            return await getDailyHoroscopeText(birthData, date);
        } catch {
            return null;
        }
    }

    const result = await response.json();
    return result.data || result;
}

/**
 * Fallback to text-based daily horoscope
 */
async function getDailyHoroscopeText(birthData: BirthData, date?: string): Promise<any> {
    const basePayload = parseBirthData(birthData);
    const now = new Date();
    const dateStr = date || now.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    const payload = {
        ...basePayload,
        prediction_time: {
            datetime: {
                year: y,
                month: m,
                day: d,
                hour: now.getUTCHours(),
                minute: now.getUTCMinutes(),
                second: 0,
            }
        }
    };

    const response = await fetch(`${API_BASE}/horoscope/personal/daily/text`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    const result = await response.json();
    return result.data || result;
}
