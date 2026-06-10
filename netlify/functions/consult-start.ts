import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { startConsultSession } from "./shared/consult-session";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const result = await startConsultSession({
      auth,
      db,
      FieldValue,
    }, await req.json());

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Consult Start] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Could not start consultation" }),
      {
        status: error.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/consult/start",
};
