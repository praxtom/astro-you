import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useConsciousness } from './useConsciousness';
import { useDashaMonitor } from './useDashaMonitor';
// AtmanService removed as it was unused
import { useToast } from '../components/ui/Toast';

/**
 * Hook to trigger proactive "Guru Nudges" based on Atman state and time
 */
export function useProactiveTriggers() {
    const { user } = useAuth();
    const { atmanState } = useConsciousness();
    const { addToast } = useToast();
    useDashaMonitor(); // Initialize the monitor
    const lastTriggerRef = useRef<Record<string, number>>({});

    // Listen for Growth Celebration Events
    useEffect(() => {
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
    }, [addToast]);

    useEffect(() => {
        if (!user || !atmanState) return;

        const checkTriggers = async () => {
            const now = new Date();
            const hour = now.getHours();
            const today = now.toISOString().split('T')[0];

            // 1. Morning Routine Nudge (10 AM - 12 PM)
            if (hour >= 10 && hour < 12) {
                const triggerKey = `routine_morning_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    const incompleteMorning = atmanState.routines?.filter(r =>
                        r.type === 'morning' && r.status === 'active' &&
                        (!r.lastCompletedAt || new Date(r.lastCompletedAt).toISOString().split('T')[0] !== today)
                    );

                    if (incompleteMorning && incompleteMorning.length > 0) {
                        addToast({
                            type: 'guru',
                            title: 'Morning Sadhana',
                            message: `The Sun has risen, ${atmanState.dailyIntention || 'Friend'}. Have you greeted it with your ${incompleteMorning[0].title}?`,
                            duration: 8000
                        });
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }

            // 2. Missing Daily Intention (Early Morning nudge)
            if (hour >= 7 && hour < 11 && !atmanState.dailyIntention) {
                const triggerKey = `intention_missing_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    addToast({
                        type: 'guru',
                        title: 'Daily Sankalpa',
                        message: "What is your intention for this beautiful new day, Ji?",
                        duration: 8000
                    });
                    lastTriggerRef.current[triggerKey] = now.getTime();
                }
            }

            // 3. Evening Gratitude (9 PM - 11 PM)
            if (hour >= 21 && hour < 23) {
                const triggerKey = `gratitude_evening_${today}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    if (!atmanState.dailyGratitudeDate || atmanState.dailyGratitudeDate !== today) {
                        addToast({
                            type: 'guru',
                            title: 'Evening Reflection',
                            message: "Before you rest, what are you grateful for today?",
                            duration: 8000
                        });
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }

            // 4. Chaotic State Check
            if (atmanState.emotionalState === 'chaotic') {
                const triggerKey = `chaos_detected_${atmanState.lastEmotionalUpdate}`;
                if (!lastTriggerRef.current[triggerKey]) {
                    addToast({
                        type: 'guru',
                        title: 'A Moment of Peace',
                        message: "I sense a storm within. Shall we take a moment for Neti-Neti reflection?",
                        duration: 10000
                    });
                    lastTriggerRef.current[triggerKey] = now.getTime();
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
                        addToast({
                            type: 'guru',
                            title: data.title,
                            message: data.message,
                            duration: 12000
                        });
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
                            addToast({
                                type: 'guru',
                                title: data.title,
                                message: data.message,
                                duration: 12000
                            });
                            lastTriggerRef.current[relationalKey] = now.getTime();
                        }
                    } catch (e) {
                        console.error("Failed to fetch relational nudge", e);
                    }
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
                        addToast({
                            type: 'guru',
                            title: 'Path Reflected',
                            message: `It has been ${daysDiff} days since "${event.title}". How has your consciousness shifted since then?`,
                            duration: 10000
                        });
                        lastTriggerRef.current[triggerKey] = now.getTime();
                    }
                }
            }
        };

        // Check every 5 minutes (300000ms)
        const interval = setInterval(checkTriggers, 300000);
        checkTriggers(); // Initial check

        return () => clearInterval(interval);
    }, [user, atmanState, addToast]);
}
