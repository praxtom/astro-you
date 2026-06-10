import { schedule } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { persistAtmanMaintenance } from "./shared/atman-brain";

export const handler = schedule("15 2 * * *", async () => {
  const limit = Number(process.env.BRAIN_MAINTENANCE_BATCH_SIZE || 200);
  const users = await db.collection("users").limit(limit).get();
  const results = [];

  for (const userDoc of users.docs) {
    try {
      const result = await persistAtmanMaintenance({ db }, userDoc.id);
      results.push({
        uid: userDoc.id,
        changed: result.changed,
        decayedPatterns: result.decayedPatterns,
        archivedPatterns: result.archivedPatterns,
      });
    } catch (err: any) {
      console.error("[BrainMaintenanceScheduled] User failed:", userDoc.id, err);
      results.push({
        uid: userDoc.id,
        changed: false,
        error: err.message || "failed",
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: results.length,
      changed: results.filter((item) => item.changed).length,
      decayedPatterns: results.reduce((sum, item) => sum + (item.decayedPatterns || 0), 0),
      archivedPatterns: results.reduce((sum, item) => sum + (item.archivedPatterns || 0), 0),
    }),
  };
});
