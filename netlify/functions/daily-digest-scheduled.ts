import type { Config } from "@netlify/functions";
import { runDailyDigestSlice } from "./shared/daily-digest-runner";
import { describeError } from "./shared/error-summary";
import { dispatchBackgroundJob } from "./shared/internal-dispatch";
import { recordJobRun, reportOpsEvent } from "./shared/ops-alerts";

/**
 * Daily trigger for the opt-in email digest (01:30 UTC = 07:00 IST).
 *
 * A scheduled function has a ~30s budget, which covers only a handful of users
 * (each one needs Auth + astrology context + Resend). So this function only
 * fans out: it dispatches `daily-digest-background` (15-min budget), which
 * walks every user with a per-day cursor and re-dispatches itself until done.
 *
 * If dispatch is impossible (no internal secret / origin), it falls back to an
 * inline slice under the old 8s deadline so the day is not lost entirely, and
 * raises an ops alert.
 */
export default async (req: Request) => {
  const runDate = new Date().toISOString().slice(0, 10);

  try {
    const dispatched = await dispatchBackgroundJob(
      "daily-digest-background",
      { runDate, hop: 0 },
      { requestUrl: req.url },
    );

    if (dispatched) {
      await recordJobRun("daily-digest-scheduler", {
        ok: true,
        note: "dispatched",
      });
      return json({ dispatched: true, runDate });
    }

    await reportOpsEvent(
      "job_dispatch_failed",
      { job: "daily-digest", target: "daily-digest-background", runDate },
      { severity: "critical", dedupeKey: `daily-digest-${runDate}` },
    );

    const slice = await runDailyDigestSlice({
      runDate,
      deadlineMs: 8_000,
      maxUsers: Number(process.env.DAILY_DIGEST_BATCH_SIZE) || 1000,
    });
    await recordJobRun("daily-digest-scheduler", {
      ok: false,
      processed: slice.processed,
      failed: slice.failed,
      skipped: slice.skipped,
      note: "inline_fallback",
    });
    return json({ dispatched: false, runDate, ...slice });
  } catch (err) {
    console.error("[DailyDigestScheduled] Failed:", describeError(err));
    await recordJobRun("daily-digest-scheduler", {
      ok: false,
      note: describeError(err).kind,
    });
    return json({ error: "daily digest trigger failed" }, 500);
  }
};

export const config: Config = { schedule: "30 1 * * *" };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
