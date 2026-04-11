import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useConsciousness } from './useConsciousness';
import { useDashaMonitor } from './useDashaMonitor';
import { AtmanService } from '../lib/atman';
import { useToast } from '../components/ui/Toast';

/**
 * Hook to trigger proactive "Guru Nudges" based on Atman state and time
 */
export function useProactiveTriggers(panchangData?: { tithi?: string; nakshatra?: string; yoga?: string; rahu_kaal?: string }) {
    const { user } = useAuth();
    const { atmanState } = useConsciousness();
    const { addToast } = useToast();
    useDashaMonitor(); // Initialize the monitor
    const lastTriggerRef = useRef<Record<string, number>>({});
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Helper: show toast AND persist to Firestore
    const showAndSaveNudge = useCallback((
        title: string,
        message: string,
        triggerType: string,
        duration = 8000
    ) => {
        addToast({ type: 'guru', title, message, duration });
        if (user) {
            AtmanService.saveNudge(user.uid, { title, message, triggerType });
        }
    }, [addToast, user]);

    // Listen for Growth Celebration Events (only when user is authenticated)
    useEffect(() => {
        if (!user) return;

        const handleGrowthDetected = (event: CustomEvent) => {
            const { contradictions } = event.detail;
            if (contradictions && contradictions.length > 0) {
                addToast({
                    type: 'guru',
                    title: '🎉 You Have Grown!',
                    message: contradictions[0],
                    duration: 12000
                });
            }
        };

        window.addEventListener('atman:growth-detected', handleGrowthDetected as EventListener);

        const handleDashaShift = (event: CustomEvent) => {
            const { planet, type, daysRemaining } = event.detail;
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const triggerKey = `dasha_${type}_${planet}_${daysRemaining}_${today}`;

            if (lastTriggerRef.current[triggerKey]) return;

            let message = "";
            let title = "Celestial Shift";

            if (daysRemaining === 30) {
                title = "A New Chapter Approaches";
                message = `In 30 days, your ${type} of ${planet} begins. Let us begin to prepare your soul for this shift.`;
            } else if (daysRemaining === 7) {
                title = "The Horizon Changes";
                message = `Only 7 days remain until your ${planet} ${type}. How are you finishing this current chapter?`;
            } else if (daysRemaining === 0) {
                title = "The Shift is Here";
                message = `Your ${planet} ${type} has begun today. Step into this new energy with awareness and grace.`;
            }

            if (message) {
                addToast({
                    type: 'guru',
                    title,
                    message,
                    duration: 12000
                });
                lastTriggerRef.current[triggerKey] = now.getTime();
            }
        };

        window.addEventListener('atman:dasha-shift-approaching', handleDashaShift as EventListener);

        return () => {
            window.removeEventListener('atman:growth-detected', handleGrowthDetected as EventListener);
            window.removeEventListener('atman:dasha-shift-approaching', handleDashaShift as EventListener);
        };
    }, [user, addToast]);

    useEffect(() => {
        if (!user || !atmanState) return;

        const checkTriggers = async () => {
            const now = new Date();
            const hour = now.getHours();
            const today = now.toISOString().split('T')[0];

            // Clean up stale keys from previous days
            const keys = Object.keys(lastTriggerRef.current);
            for (const key of keys) {
                // Keep keys that contain today's date or are not date-keyed
                if (key.includes('_') && !key.includes(today)) {
                    // Check if the key ends with a date pattern (YYYY-MM-DD)
                    const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
                    if (dateMatch && dateMatch[0] !== today) {
                        delete lastTriggerRef.current[key];
                    }
                }
            }

            // 1. Morning Routine Nudge (10 AM - 12 PM)
            if (hour >= 10 && hour < 12) {
                const triggerKey = `routine_morning_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    const incompleteMorning = atmanState.routines?.filter(r =>
                        r.type === 'morning' && r.status === 'active' &&
                        (!r.lastCompletedAt || new Date(r.lastCompletedAt).toISOString().split('T')[0] !== today)
                    );

                    if (incompleteMorning && incompleteMorning.length > 0) {
                        showAndSaveNudge(
                            'Morning Sadhana',
                            `The Sun has risen, ${atmanState.dailyIntention || 'Friend'}. Have you greeted it with your ${incompleteMorning[0].title}?`,
                            'morning_routine'
                        );
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }

            // 1b. Tithi & Nakshatra Morning Nudge (7-9 AM)
            if (panchangData?.tithi && panchangData.tithi !== '—') {
                const tithiKey = `tithi_${today}`;
                if (!lastTriggerRef.current[tithiKey] && hour >= 7 && hour <= 9) {
                    lastTriggerRef.current[tithiKey] = now.getTime();
                    showAndSaveNudge(
                        "Today's Tithi",
                        `${panchangData.tithi}. ${panchangData.nakshatra ? `Nakshatra: ${panchangData.nakshatra}.` : ''} A good day for spiritual practice.`,
                        'tithi_morning'
                    );
                }
            }

            // 2. Missing Daily Intention (Early Morning nudge)
            if (hour >= 7 && hour < 11 && !atmanState.dailyIntention) {
                const triggerKey = `intention_missing_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    showAndSaveNudge(
                        'Daily Sankalpa',
                        "What is your intention for this beautiful new day, Ji?",
                        'daily_intention'
                    );
                    lastTriggerRef.current[triggerKey] = now.getTime();
                }
            }

            // 3. Evening Reflection — personalized with day's Tithi energy
            if (hour >= 21 && hour < 23) {
                const triggerKey = `gratitude_evening_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    if (!atmanState.dailyGratitudeDate || atmanState.dailyGratitudeDate !== today) {
                        let message = "Before you rest, what are you grateful for today?";

                        if (panchangData?.tithi) {
                            const tithiGuidance: Record<string, string> = {
                                'pratipada': 'begin fresh',
                                'dwitiya': 'nurture connections',
                                'tritiya': 'express creativity',
                                'chaturthi': 'overcome obstacles',
                                'panchami': 'pursue knowledge',
                                'shashthi': 'serve others',
                                'saptami': 'seek adventure',
                                'ashtami': 'transform within',
                                'navami': 'honor the divine feminine',
                                'dashami': 'celebrate achievements',
                                'ekadashi': 'practice devotion',
                                'dwadashi': 'cultivate patience',
                                'trayodashi': 'share abundance',
                                'chaturdashi': 'release what no longer serves',
                                'purnima': 'reflect on fullness and gratitude',
                                'amavasya': 'turn inward and plant seeds of intention',
                            };
                            const tithiLower = panchangData.tithi.toLowerCase();
                            const guidance = Object.entries(tithiGuidance).find(([k]) => tithiLower.includes(k));
                            if (guidance) {
                                message = `Today's ${panchangData.tithi} energy invited you to ${guidance[1]}. How did you honor that?`;
                            }
                        }

                        showAndSaveNudge('Evening Reflection', message, 'evening_gratitude');
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }

            // 3b. Evening Reflection with Transit Awareness (8-10 PM)
            const eveningReflectionKey = `evening_reflection_${today}`;
            if (!lastTriggerRef.current[eveningReflectionKey] && hour >= 20 && hour <= 22) {
                if (user && atmanState && (!atmanState.dailyGratitudeDate || !atmanState.dailyGratitudeDate.includes(today))) {
                    lastTriggerRef.current[eveningReflectionKey] = now.getTime();
                    const transitNote = panchangData?.nakshatra
                        ? `Under ${panchangData.nakshatra}'s influence, `
                        : '';
                    showAndSaveNudge(
                        'Evening Reflection',
                        `${transitNote}take a moment to reflect on today. What are you grateful for?`,
                        'evening_reflection'
                    );
                }
            }

            // 4. Chaotic State Check
            if (atmanState.emotionalState === 'chaotic') {
                const triggerKey = `chaos_detected_${atmanState.lastEmotionalUpdate}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    showAndSaveNudge(
                        'A Moment of Peace',
                        "I sense a storm within. Shall we take a moment for Neti-Neti reflection?",
                        'emotional_stabilization',
                        10000
                    );
                    lastTriggerRef.current[triggerKey] = now.getTime();
                }
            }

            // 4b. Rahu Kaal Warning
            if (panchangData?.rahu_kaal) {
                const rahuKey = `rahu_kaal_${today}`;
                if (!lastTriggerRef.current[rahuKey]) {
                    try {
                        const parts = panchangData.rahu_kaal.split('-').map(s => s.trim());
                        if (parts.length === 2) {
                            const parseTime = (str: string): number => {
                                const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                                if (!match) return -1;
                                let h = parseInt(match[1]);
                                const m = parseInt(match[2]);
                                if (match[3]?.toUpperCase() === 'PM' && h !== 12) h += 12;
                                if (match[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
                                return h * 60 + m;
                            };
                            const startMin = parseTime(parts[0]);
                            const currentMin = hour * 60 + now.getMinutes();
                            if (startMin > 0 && currentMin >= startMin - 15 && currentMin <= startMin + 5) {
                                showAndSaveNudge(
                                    'Rahu Kaal Approaching',
                                    `Rahu Kaal begins soon (${panchangData.rahu_kaal}). Avoid starting new ventures during this period. Use it for reflection instead.`,
                                    'rahu_kaal_warning'
                                );
                                lastTriggerRef.current[rahuKey] = now.getTime();
                            }
                        }
                    } catch {
                        // Silent fail — panchang format may vary
                    }
                }
            }

            // 6. Transit Alert (Once per day)
            const transitKey = `transit_alert_${today}`;
            if (!lastTriggerRef.current[transitKey]) {
                try {
                    const response = await fetch('/api/proactive-nudge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            atmanData: atmanState,
                            triggerType: 'transit_alert'
                        })
                    });
                    const data = await response.json();
                    if (data.title && data.message) {
                        showAndSaveNudge(data.title, data.message, 'transit_alert', 12000);
                        lastTriggerRef.current[transitKey] = now.getTime();
                    }
                } catch (e) {
                    console.error("Failed to fetch transit nudge", e);
                }
            }

            // 7. Relational Management Nudge (Once per day, late afternoon)
            if (hour >= 15 && hour < 18 && atmanState.keyRelationships && (atmanState.keyRelationships.length || 0) > 0) {
                const relationalKey = `relational_nudge_${today}`;
                if (!lastTriggerRef.current[relationalKey]) {
                    try {
                        const response = await fetch('/api/proactive-nudge', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                atmanData: atmanState,
                                triggerType: 'relational_management'
                            })
                        });
                        const data = await response.json();
                        if (data.title && data.message) {
                            showAndSaveNudge(data.title, data.message, 'relational_management', 12000);
                            lastTriggerRef.current[relationalKey] = now.getTime();
                        }
                    } catch (e) {
                        console.error("Failed to fetch relational nudge", e);
                    }
                }
            }

            // 7b. Daily Synastry Alert — Compassion Nudge (2 PM - 5 PM, once per day)
            if (hour >= 14 && hour < 17 && atmanState.keyRelationships && atmanState.keyRelationships.length > 0) {
                const synastryKey = `synastry_alert_${today}`;
                if (!lastTriggerRef.current[synastryKey]) {
                    const partner = atmanState.keyRelationships.find((r: any) => r.relation === 'partner' && r.birthData)
                        || atmanState.keyRelationships.find((r: any) => r.birthData);

                    if (partner) {
                        try {
                            const response = await fetch('/api/proactive-nudge', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    atmanData: atmanState,
                                    triggerType: 'synastry_alert',
                                    partnerData: {
                                        name: partner.name,
                                        relation: partner.relation,
                                        dynamic: partner.dynamic,
                                        zodiacSign: partner.zodiacSign,
                                    }
                                })
                            });
                            const data = await response.json();
                            if (data.title && data.message) {
                                showAndSaveNudge(data.title, data.message, 'synastry_alert', 12000);
                                lastTriggerRef.current[synastryKey] = now.getTime();
                            }
                        } catch (e) {
                            console.error("Failed to fetch synastry nudge", e);
                        }
                    }
                }
            }

            // 7c. Daily Synastry Alert — partner transit compassion (3 PM - 6 PM, once per day)
            const synastryKey = `synastry_${today}`;
            if (!lastTriggerRef.current[synastryKey] && hour >= 15 && hour <= 18 && atmanState?.keyRelationships?.length) {
                const partner = atmanState.keyRelationships.find((r: any) => r.relation === 'partner' || r.relation === 'spouse');
                if (partner) {
                    lastTriggerRef.current[synastryKey] = now.getTime();
                    const toneMap: Record<string, string> = {
                        partner: 'your relationship',
                        spouse: 'your marriage',
                        parent: 'your family bond',
                        child: 'parenting',
                        boss: 'your work dynamic',
                        friend: 'your friendship',
                    };
                    const tone = toneMap[partner.relation] || 'your connection';
                    showAndSaveNudge(
                        `Relational Insight: ${partner.name}`,
                        `The stars suggest patience in ${tone} with ${partner.name} today. Communication may need extra care.`,
                        'synastry_partner_transit'
                    );
                }
            }

            // 5. Anniversary Wisdom (Completed events from 7 or 30 days ago)
            const completedEvents = atmanState.activeEvents?.filter(e => e.status === 'completed' && e.date) || [];
            for (const event of completedEvents) {
                const eventDate = new Date(event.date!);
                const daysDiff = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));

                if (daysDiff === 7 || daysDiff === 30) {
                    const triggerKey = `anniversary_${event.id}_${daysDiff}`;
                    if (!lastTriggerRef.current[triggerKey]) {
                        showAndSaveNudge(
                            'Path Reflected',
                            `It has been ${daysDiff} days since "${event.title}". How has your consciousness shifted since then?`,
                            'anniversary_reflection',
                            10000
                        );
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }
        };

        // Check every 5 minutes using recursive setTimeout to prevent overlap
        const scheduleNext = () => {
            timeoutRef.current = setTimeout(async () => {
                await checkTriggers();
                scheduleNext();
            }, 300000);
        };

        checkTriggers(); // Initial check
        scheduleNext();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [user, atmanState, addToast, showAndSaveNudge, panchangData]);
}
