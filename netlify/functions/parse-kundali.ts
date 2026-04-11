/**
 * Parse Kundali Chart Image - Netlify Function
 * Uses Gemini Vision to extract planetary positions from uploaded chart images
 */

import { Config, Context } from "@netlify/functions";
import { parseChartImage } from "./shared/gemini";

interface ParseKundaliRequest {
    imageBase64: string;
    mimeType: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

export default async (req: Request, _context: Context) => {
    // Handle preflight
    if (req.method === "OPTIONS") {
        return new Response("", { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: corsHeaders }
        );
    }

    try {
        const body: ParseKundaliRequest = await req.json();

        if (!body.imageBase64 || !body.mimeType) {
            return new Response(
                JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate mime type
        const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimeTypes.includes(body.mimeType)) {
            return new Response(
                JSON.stringify({
                    error: "Invalid image format. Supported: JPG, PNG, WebP",
                }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Parse the chart using Gemini Vision
        const result = await parseChartImage(body.imageBase64, body.mimeType);

        // Check for parsing errors
        if (result.error) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: result.error,
                    rawText: result.rawText,
                }),
                { status: 422, headers: corsHeaders }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: result,
            }),
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error("Parse Kundali Error:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to parse chart image",
                details: error.message,
            }),
            { status: 500, headers: corsHeaders }
        );
    }
};

export const config: Config = { path: "/.netlify/functions/parse-kundali" };
