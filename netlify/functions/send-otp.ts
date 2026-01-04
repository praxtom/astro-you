import { Config, Context } from "@netlify/functions";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (only once)
if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();

// Generate a random 4-digit code
function generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { email } = await req.json();

        if (!email || !email.includes("@")) {
            return new Response(JSON.stringify({ error: "Invalid email" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

        // Store OTP in Firestore
        await db.collection("otps").doc(email).set({
            code: otp,
            expiresAt,
            createdAt: Date.now(),
        });

        // Send email via Resend (or log for testing)
        const resendApiKey = process.env.RESEND_API_KEY;

        if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                    from: "AstroYou <noreply@astroyou.app>",
                    to: email,
                    subject: "Your Celestial Access Code",
                    html: `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px; background: linear-gradient(180deg, #0a0a14 0%, #1a1a2e 100%); border-radius: 16px; text-align: center;">
              <h1 style="color: #FFD700; font-size: 24px; margin-bottom: 8px;">AstroYou</h1>
              <p style="color: #a0a0c0; font-size: 14px; margin-bottom: 32px;">Your gateway to celestial wisdom</p>
              <div style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #a0a0c0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Your Access Code</p>
                <h2 style="color: #FFD700; font-size: 48px; letter-spacing: 12px; margin: 0; font-weight: bold;">${otp}</h2>
              </div>
              <p style="color: #606080; font-size: 12px;">This code expires in 5 minutes.</p>
            </div>
          `,
                }),
            });
        } else {
            // For testing without email service
            console.log(`[DEV] OTP for ${email}: ${otp}`);
        }

        return new Response(JSON.stringify({ success: true, message: "Code sent to your email" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Send OTP Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/auth/send-otp",
};
