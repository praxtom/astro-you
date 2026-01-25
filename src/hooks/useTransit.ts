import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { NatalTransitData } from "../types/kundali";

interface TransitState {
    data: NatalTransitData | null;
    predictions: any[] | null;
    aiSummary: string | null;
    loading: boolean;
    error: string | null;
}

export function useTransit(transitDate?: string) {
    const { user } = useAuth();
    const [state, setState] = useState<TransitState>({
        data: null,
        predictions: null,
        aiSummary: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        async function fetchTransit() {
            // Get birth data from localStorage (guest or user)
            const storedProfile = localStorage.getItem("astroyou_profile");
            if (!storedProfile) {
                setState(prev => ({ ...prev, loading: false, error: "No profile found" }));
                return;
            }

            const birthData = JSON.parse(storedProfile);

            try {
                setState(prev => ({ ...prev, loading: true, error: null }));

                const response = await fetch("/.netlify/functions/transit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        birthData,
                        transitDate: transitDate || new Date().toISOString().split('T')[0]
                    }),
                });

                const result = await response.json();

                if (result.success) {
                    setState({
                        data: result.data.positions,
                        predictions: result.data.predictions,
                        aiSummary: result.data.aiSummary,
                        loading: false,
                        error: null,
                    });
                } else {
                    throw new Error(result.error || "Failed to fetch transit data");
                }
            } catch (err: any) {
                console.error("Transit hook error:", err);
                setState(prev => ({ ...prev, loading: false, error: err.message }));
            }
        }

        fetchTransit();
    }, [user, transitDate]);

    return state;
}
