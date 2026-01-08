import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const payload = JSON.parse(event.body || "{}");

        // Check if we received the direct API payload or our internal app format
        // The Dashboard currently sends the Direct API Payload format
        const hasSubject = !!payload.subject;

        // Use the official API base from their documentation
        const url = "https://api.astrology-api.io/api/v3/horoscope/sign/daily/text";

        console.log(`[DailyPrediction] Proxying request to ${url}`);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        return {
            statusCode: response.status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("[DailyPrediction] Proxy error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
