import { Config, Context } from "@netlify/functions";
import crypto from "crypto";
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

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            uid,
            minutes
        } = await req.json();

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid || !minutes) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Verify the payment signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(body.toString())
            .digest("hex");

        const isMatch = expectedSignature === razorpay_signature;

        if (!isMatch) {
            return new Response(JSON.stringify({ status: "failure" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Verify the user exists
        await auth.getUser(uid);

        // Add credits server-side (Admin SDK bypasses Firestore rules)
        const userRef = db.collection("users").doc(uid);
        await userRef.update({
            credits: FieldValue.increment(minutes),
        });

        return new Response(JSON.stringify({ status: "success", creditsAdded: minutes }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Payment verification error:", error);
        return new Response(JSON.stringify({ error: "Payment verification failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/pay/verify"
};
