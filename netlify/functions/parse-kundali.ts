/**
 * Parse Kundali Chart Image - Netlify Function
 * Uses Gemini Vision to extract planetary positions from uploaded chart images
 */

import type { Handler } from "@netlify/functions";
import { parseChartImage } from "./shared/gemini";

interface ParseKundaliRequest {
    imageBase64: string;
    mimeType: string;
}

export const handler: Handler = async (event) => {
    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
    };

    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method not allowed" }),
        };
    }

    try {
        const body: ParseKundaliRequest = JSON.parse(event.body || "{}");

        if (!body.imageBase64 || !body.mimeType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
            };
        }

        // Validate mime type
        const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimeTypes.includes(body.mimeType)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Invalid image format. Supported: JPG, PNG, WebP",
                }),
            };
        }

        // Parse the chart using Gemini Vision
        const result = await parseChartImage(body.imageBase64, body.mimeType);

        // Check for parsing errors
        if (result.error) {
            return {
                statusCode: 422,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: result.error,
                    rawText: result.rawText,
                }),
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: result,
            }),
        };
    } catch (error: any) {
        console.error("Parse Kundali Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Failed to parse chart image",
                details: error.message,
            }),
        };
    }
};
