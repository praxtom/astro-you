import { schedule } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { persistAtmanMaintenance } from "./shared/atman-brain";
import { processUsersPaged } from "./shared/scheduled-users";

export const handler = schedule("15 2 * * *", async () => {
  const maxUsers = Number(process.env.BRAIN_MAINTENANCE_BATCH_SIZE || 1000);
  let changed = 0;
  let decayedPatterns = 0;
  let archivedPatterns = 0;
  let failed = 0;

  const { processed, reachedEnd } = await processUsersPaged(
    { job: "brain-maintenance", maxUsers },
    async (userDoc) => {
      try {
        const result = await persistAtmanMaintenance({ db }, userDoc.id);
        if (result.changed) changed += 1;
        decayedPatterns += result.decayedPatterns || 0;
        archivedPatterns += result.archivedPatterns || 0;
      } catch (err: any) {
        failed += 1;
        console.error(
          "[BrainMaintenanceScheduled] User failed:",
          userDoc.id,
          err,
        );
      }
    },
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed,
      reachedEnd,
      changed,
      decayedPatterns,
      archivedPatterns,
      failed,
    }),
  };
});
