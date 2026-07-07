/**
 * Parse Kundali Chart Image - Netlify Function
 * Uses Gemini Vision to extract planetary positions from uploaded chart images
 */

import { Config, Context } from "@netlify/functions";
import { parseChartImage } from "./shared/gemini";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";

interface ParseKundaliRequest {
  imageBase64: string;
  mimeType: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ~8MB of base64 (≈6MB of image) — plenty for a chart photo, and a hard cap
// on what a single request can feed into paid Gemini Vision.
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024;

/**
 * Fail-closed per-IP limiter. "parse_kundali" is not enrolled in the shared
 * limiter's FAIL_CLOSED_SCOPES, whose outage fallback reports
 * `{ allowed: true, remaining: 0 }` — the same shape as the final in-budget
 * request. Denying `remaining <= 0` (and sizing the limit one above the real
 * budget) therefore also denies during limiter-store outages: this endpoint
 * is reachable by guests (onboarding chart upload) and every request runs
 * paid Gemini Vision, so it must never fail open.
 */
async function allowAnonRequest(
  req: Request,
  scope: string,
  budget: number,
  windowMs: number,
): Promise<boolean> {
  const result = await checkRateLimit({
    scope,
    key: getRequestIdentifier(req),
    limit: budget + 1,
    windowMs,
  });
  return result.allowed && result.remaining > 0;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const allowed = await allowAnonRequest(
      req,
      "parse_kundali",
      5,
      60 * 60 * 1000,
    );
    if (!allowed) {
      return json({ error: "Too many uploads. Please try again later." }, 429);
    }

    const body: ParseKundaliRequest = await req.json();

    if (
      !body.imageBase64 ||
      typeof body.imageBase64 !== "string" ||
      !body.mimeType
    ) {
      return json({ error: "Missing imageBase64 or mimeType" }, 400);
    }

    if (body.imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return json({ error: "Image too large. Maximum size is 6MB." }, 413);
    }

    // Validate mime type
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimeTypes.includes(body.mimeType)) {
      return json(
        { error: "Invalid image format. Supported: JPG, PNG, WebP" },
        400,
      );
    }

    // Parse the chart using Gemini Vision
    const result = await parseChartImage(body.imageBase64, body.mimeType);

    // Check for parsing errors
    if (result.error) {
      return json(
        { success: false, error: result.error, rawText: result.rawText },
        422,
      );
    }

    return json({ success: true, data: result });
  } catch (error: any) {
    console.error("Parse Kundali Error:", error);
    // Generic message — never leak internals to the client.
    return json({ error: "Failed to parse chart image" }, 500);
  }
};

export const config: Config = { path: "/api/parse-kundali" };
