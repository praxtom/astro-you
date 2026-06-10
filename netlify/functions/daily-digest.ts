import { Config, Context } from "@netlify/functions";
import { auth } from "./shared/firebase-admin";
import { generateDailyDigestForUser } from "./shared/daily-digest-runner";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { idToken, sendEmail = false } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing idToken" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const result = await generateDailyDigestForUser({
      uid: decoded.uid,
      sendEmail,
      channel: sendEmail ? "email" : "preview",
    });

    if (result.skippedReason === "email_digest_disabled") {
      return new Response(
        JSON.stringify({ error: "Email digest is disabled" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[DailyDigest] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Digest failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/daily-digest" };
