import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DashaTransition {
    planet: string;
    date: Date;
    type: 'Mahadasha' | 'Antardasha';
}

/**
 * Hook to monitor upcoming significant Dasha transitions.
 * Triggers events for proactive preparation nudges.
 */
export function useDashaMonitor() {
    const { user } = useAuth();
    const [upcomingTransition, setUpcomingTransition] = useState<DashaTransition | null>(null);
    const lastCheckRef = useRef<number>(0);

    useEffect(() => {
        if (!user) return;

        const checkTransitions = async () => {
            // Rate limit checks to once per hour
            const now = Date.now();
            if (now - lastCheckRef.current < 3600000) return;
            lastCheckRef.current = now;

            try {
                // Get birth data from user profile
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (!userDoc.exists()) return;
                const profile = userDoc.data();

                if (!profile.dob || !profile.tob) return;

                const birthData = {
                    dob: profile.dob,
                    tob: profile.tob,
                    pob: profile.pob || "Unknown",
                    lat: profile.coordinates?.lat,
                    lng: profile.coordinates?.lng
                };

                const response = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        birthData,
                        chartType: 'DASHAS'
                    })
                });

                if (!response.ok) return;
                const dashas = await response.json();

                // Find next transition in the next 35 days
                const thirtyFiveDaysFromNow = new Date();
                thirtyFiveDaysFromNow.setDate(thirtyFiveDaysFromNow.getDate() + 35);

                const nextShift = findNextSignificantShift(dashas, new Date(), thirtyFiveDaysFromNow);
                if (nextShift) {
                    setUpcomingTransition(nextShift);

                    // Emit custom event for useProactiveTriggers
                    const event = new CustomEvent('atman:dasha-shift-approaching', {
                        detail: {
                            planet: nextShift.planet,
                            date: nextShift.date,
                            type: nextShift.type,
                            daysRemaining: Math.ceil((nextShift.date.getTime() - now) / (1000 * 60 * 60 * 24))
                        }
                    });
                    window.dispatchEvent(event);
                }
            } catch (e) {
                console.error("Dasha Monitor fail:", e);
            }
        };

        checkTransitions();
        const interval = setInterval(checkTransitions, 3600000);
        return () => clearInterval(interval);
    }, [user]);

    return upcomingTransition;
}

function findNextSignificantShift(dashas: any[], now: Date, limit: Date): DashaTransition | null {
    if (!dashas || !Array.isArray(dashas)) return null;

    for (const d of dashas) {
        const endDate = new Date(d.endDate);
        if (endDate > now && endDate < limit) {
            return {
                planet: d.planet,
                date: endDate,
                type: 'Mahadasha'
            };
        }

        // Also check sub-periods (Antardashas)
        if (d.subPeriods) {
            for (const sd of d.subPeriods) {
                const sEndDate = new Date(sd.endDate);
                if (sEndDate > now && sEndDate < limit) {
                    return {
                        planet: sd.planet,
                        date: sEndDate,
                        type: 'Antardasha'
                    };
                }
            }
        }
    }

    return null;
}
