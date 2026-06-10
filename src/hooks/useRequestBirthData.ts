import { useMemo } from 'react';
import type { BirthData } from '../types';

export function useRequestBirthData(birthData: Partial<BirthData> | null | undefined): BirthData | null {
    const name = birthData?.name ?? '';
    const dob = birthData?.dob ?? '';
    const tob = birthData?.tob ?? '';
    const pob = birthData?.pob ?? '';
    const gender = birthData?.gender;
    const birthTimeUnknown = birthData?.birthTimeUnknown;
    const lat = birthData?.coordinates?.lat;
    const lng = birthData?.coordinates?.lng;

    return useMemo(() => {
        const hasAnyBirthField = Boolean(name || dob || tob || pob || gender || birthTimeUnknown || lat !== undefined || lng !== undefined);
        if (!hasAnyBirthField) return null;

        return {
            name,
            dob,
            tob,
            pob,
            gender,
            birthTimeUnknown,
            coordinates: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
        };
    }, [name, dob, tob, pob, gender, birthTimeUnknown, lat, lng]);
}
