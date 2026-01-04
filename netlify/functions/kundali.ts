import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData } = await req.json();

        if (!birthData || !birthData.dob || !birthData.tob) {
            return new Response(JSON.stringify({ error: "Missing birth data" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Parse date and time
        // dob: YYYY-MM-DD
        // tob: HH:MM
        const [year, month, day] = birthData.dob.split("-").map(Number);
        const [hour, minute] = birthData.tob.split(":").map(Number);

        const payload = {
            subject: {
                name: birthData.name || "User",
                birth_data: {
                    year,
                    month,
                    day,
                    hour,
                    minute,
                    city: birthData.pob || "Mumbai",
                },
            },
            options: {
                house_system: "W",
                zodiac_type: "Sidereal",
                active_points: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Mean_Node", "Mean_South_Node", "Ascendant"],
                precision: 2,
            },
        };

        const response = await fetch("https://api.astrology-api.io/api/v3/charts/natal", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Kundali API error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/kundali",
};
