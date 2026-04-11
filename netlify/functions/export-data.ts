import { Config, Context } from "@netlify/functions";
import { db, auth } from "./shared/firebase-admin";

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const { idToken } = await req.json();
    if (!idToken) return new Response(JSON.stringify({ error: "Missing auth token" }), { status: 401, headers: { "Content-Type": "application/json" } });

    try {
        const decoded = await auth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // Gather all user data
        const userDoc = await db.collection("users").doc(uid).get();
        const chatsSnapshot = await db.collection("users").doc(uid).collection("chats").get();

        const chats = [];
        for (const chatDoc of chatsSnapshot.docs) {
            chats.push({ id: chatDoc.id, ...chatDoc.data() });
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            profile: userDoc.data()?.profile || {},
            credits: userDoc.data()?.credits,
            subscription: userDoc.data()?.subscription,
            atman: userDoc.data()?.atman || {},
            kundaliData: userDoc.data()?.kundaliData || {},
            chats,
        };

        return new Response(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename=astroyou-data-${uid}.json`,
            },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};

export const config: Config = { path: "/api/export-data" };
