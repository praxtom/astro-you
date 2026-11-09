import type { Config } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { persistAtmanMaintenance } from "./shared/atman-brain";
import { processUsersPaged } from "./shared/scheduled-users";
import { recordJobRun } from "./shared/ops-alerts";

export default async (_req: Request) => {
  try {
    return await runBrainMaintenance();
  } catch (err) {
    console.error("[BrainMaintenanceScheduled] Run failed:", err);
    await recordJobRun("brain-maintenance", { ok: false, note: "run_threw" });
    return new Response(JSON.stringify({ error: "brain_maintenance_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

async function runBrainMaintenance(): Promise<Response> {
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

  const summary = {
    processed,
    reachedEnd,
    changed,
    decayedPatterns,
    archivedPatterns,
    failed,
  };
  await recordJobRun("brain-maintenance", {
    ok: true,
    processed,
    failed,
    note: reachedEnd ? undefined : "batch_limit",
  });
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { schedule: "15 2 * * *" };
