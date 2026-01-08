import { Handler } from "@netlify/functions";
import { getCompatibilityDetails } from "./shared/astro-api";

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { maleData, femaleData } = JSON.parse(event.body || "{}");

        if (!maleData || !femaleData) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Male and female birth data are required" }),
            };
        }

        const matchData = await getCompatibilityDetails(maleData, femaleData);

        if (!matchData) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Failed to fetch compatibility data" }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(matchData),
        };
    } catch (error: any) {
        console.error("[Compatibility] Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
