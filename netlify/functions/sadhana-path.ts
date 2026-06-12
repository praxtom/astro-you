import { Config, Context } from "@netlify/functions";
import { generateSadhanaPath } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import {
    AuthError,
    enforceIpRateLimit,
    verifyToken,
} from "./shared/require-auth";

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, idToken } = await req.json();

        let decoded;
        try {
            decoded = await verifyToken(idToken);
            await enforceIpRateLimit(req, "sadhana_path", 20, 60 * 60 * 1000);
        } catch (err) {
            const status = err instanceof AuthError ? err.status : 401;
            return new Response(
                JSON.stringify({
                    error:
                        err instanceof AuthError ? err.message : "Authentication required",
                }),
                { status, headers: { "Content-Type": "application/json" } },
            );
        }

        const { userContext } = await buildUserContext({
            uid: decoded.uid,
            birthData,
        });

        const path = await generateSadhanaPath(userContext);

        return new Response(JSON.stringify({ path }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Sadhana path error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/sadhana-path"
};
