import { randomUUID } from "node:crypto";
import {
  addDigestTotals,
  type DigestBatchTotals,
  runDailyDigestSlice,
} from "./shared/daily-digest-runner";
import { describeError } from "./shared/error-summary";
import {
  dispatchBackgroundJob,
  INTERNAL_AUTH_HEADER,
  isAuthorizedInternalRequest,
} from "./shared/internal-dispatch";
import { recordJobRun, reportOpsEvent } from "./shared/ops-alerts";
import { acquireJobLease } from "./shared/scheduled-users";

/**
 * Background worker for the daily digest (15-min platform cap).
 *
 * Dispatched by daily-digest-scheduled with `{ runDate, hop }`. Processes
 * users from the per-day cursor for ~13 minutes, then — if users remain —
 * re-dispatches itself with `hop + 1` and the running totals. The cursor is
 * keyed by runDate, so a chain always covers every user once per day, a
 * double-fired trigger is a no-op once the day is complete, and the lease
 * keeps two slices from walking the same cursor concurrently.
 *
 * Internal-only: requires the shared internal secret header.
 */

const DEFAULT_DEADLINE_MS = 13 * 60 * 1000;
const LEASE_MS = 14 * 60 * 1000 + 30 * 1000;
const DEFAULT_MAX_HOPS = 24;

export default async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!isAuthorizedInternalRequest(req)) {
    // A request that carries the header but fails the check is a config
    // mismatch between functions (or a forged call) — make it visible.
    if (req.headers.get(INTERNAL_AUTH_HEADER)) {
      await reportOpsEvent(
        "internal_auth_mismatch",
        { function: "daily-digest-background" },
        { severity: "critical", dedupeKey: "daily-digest-background" },
      );
    }
    return new Response("Forbidden", { status: 403 });
  }

  let body: { runDate?: unknown; hop?: unknown; totals?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const runDate =
    typeof body.runDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.runDate)
      ? body.runDate
      : new Date().toISOString().slice(0, 10);
  const hop =
    typeof body.hop === "number" && Number.isInteger(body.hop) && body.hop >= 0
      ? body.hop
      : 0;
  const carried = (
    body.totals && typeof body.totals === "object" ? body.totals : {}
  ) as Partial<DigestBatchTotals>;

  const maxHops = Number(process.env.DAILY_DIGEST_MAX_HOPS) || DEFAULT_MAX_HOPS;
  const deadlineMs =
    Number(process.env.DAILY_DIGEST_DEADLINE_MS) || DEFAULT_DEADLINE_MS;

  const release = await acquireJobLease(
    "daily-digest",
    randomUUID(),
    LEASE_MS,
  ).catch((err) => {
    console.error("[DailyDigestBg] Lease failed:", describeError(err));
    return null;
  });
  if (!release) {
    console.warn(`[DailyDigestBg] Another slice holds the lease (hop ${hop})`);
    return new Response(null, { status: 202 });
  }

  let totals = addDigestTotals(carried, {});
  try {
    const slice = await runDailyDigestSlice({
      runDate,
      deadlineMs: Math.min(deadlineMs, DEFAULT_DEADLINE_MS),
      maxUsers: Number(process.env.DAILY_DIGEST_BATCH_SIZE) || 100_000,
      // Each user triggers astrology API calls; keep parallelism modest so
      // the provider's rate limit is not the bottleneck.
      concurrency: Number(process.env.DAILY_DIGEST_CONCURRENCY) || 2,
    });
    totals = addDigestTotals(totals, slice);
    console.warn(
      `[DailyDigestBg] ${runDate} hop=${hop} processed=${slice.processed} sent=${slice.emailSent} failed=${slice.failed} end=${slice.reachedEnd}`,
    );
    await release();

    if (slice.alreadyCompleted) {
      return new Response(null, { status: 202 });
    }

    if (slice.reachedEnd) {
      await recordJobRun("daily-digest", {
        ok: true,
        processed: totals.processed,
        failed: totals.failed,
        skipped: totals.skipped,
        note: `sent=${totals.emailSent} hops=${hop + 1}`,
      });
      return new Response(null, { status: 202 });
    }

    if (hop + 1 >= maxHops) {
      await recordJobRun("daily-digest", {
        ok: false,
        processed: totals.processed,
        failed: totals.failed,
        skipped: totals.skipped,
        note: "max_hops",
      });
      return new Response(null, { status: 202 });
    }

    const next = await dispatchBackgroundJob(
      "daily-digest-background",
      { runDate, hop: hop + 1, totals },
      { requestUrl: req.url },
    );
    if (!next) {
      await reportOpsEvent(
        "job_dispatch_failed",
        { job: "daily-digest", hop: hop + 1, runDate },
        { severity: "critical", dedupeKey: `daily-digest-${runDate}` },
      );
      await recordJobRun("daily-digest", {
        ok: false,
        processed: totals.processed,
        failed: totals.failed,
        skipped: totals.skipped,
        note: "redispatch_failed",
      });
    }
  } catch (err) {
    await release();
    console.error("[DailyDigestBg] Slice failed:", describeError(err));
    await recordJobRun("daily-digest", {
      ok: false,
      processed: totals.processed,
      failed: totals.failed,
      note: describeError(err).kind,
    });
  }
  return new Response(null, { status: 202 });
};
