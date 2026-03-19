import { Config, Context } from "@netlify/functions";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin (only once)
if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();
const auth = getAuth();

const MAX_ATTEMPTS = 5;

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { email, code } = await req.json();

        if (!email || !code) {
            return new Response(JSON.stringify({ error: "Email and code are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Get stored OTP from Firestore
        const otpDoc = await db.collection("otps").doc(email).get();

        if (!otpDoc.exists) {
            return new Response(JSON.stringify({ error: "No code found. Please request a new one." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const otpData = otpDoc.data();

        // Check if too many failed attempts
        if ((otpData?.attempts || 0) >= MAX_ATTEMPTS) {
            await db.collection("otps").doc(email).delete();
            return new Response(JSON.stringify({ error: "Too many failed attempts. Please request a new code." }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check if expired
        if (Date.now() > otpData?.expiresAt) {
            await db.collection("otps").doc(email).delete();
            return new Response(JSON.stringify({ error: "Code expired. Please request a new one." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Verify OTP
        if (otpData?.code !== code) {
            // Increment failed attempts
            await db.collection("otps").doc(email).update({
                attempts: FieldValue.increment(1),
            });
            const remaining = MAX_ATTEMPTS - (otpData?.attempts || 0) - 1;
            return new Response(JSON.stringify({ error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // OTP is valid - delete it to prevent reuse
        await db.collection("otps").doc(email).delete();

        // Get or create the user
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                // Create new user
                userRecord = await auth.createUser({
                    email,
                    emailVerified: true,
                });
            } else {
                throw error;
            }
        }

        // Ensure the user has a Firestore document and initial credits
        const userDocRef = db.collection("users").doc(userRecord.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists || userDoc.data()?.credits === undefined) {
            await userDocRef.set({
                email,
                credits: 15, // Initial bonus credits
                createdAt: userDoc.exists ? (userDoc.data()?.createdAt || new Date()) : new Date(),
            }, { merge: true });
        }

        // Create a custom token for the user
        const customToken = await auth.createCustomToken(userRecord.uid);

        return new Response(JSON.stringify({ success: true, token: customToken }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Verify OTP Error:", error);
        return new Response(JSON.stringify({ error: "Verification failed. Please try again." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/auth/verify-otp",
};
