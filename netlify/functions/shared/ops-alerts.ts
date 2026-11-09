/**
 * Server-side operational alerting.
 *
 * Failures that matter to the business (payments that did not grant credits,
 * scheduled jobs that stopped, email provider errors, background-function auth
 * mismatches, account-deletion cleanup failures) used to land only in function
 * logs, which nobody reads in real time. This module gives them two durable
 * sinks:
 *
 *  - `opsEvents/{id}` in Firestore (TTL via `expiresAt`, see
 *    firestore.indexes.json), surfaced in the admin operations queue;
 *  - an optional webhook (`OPS_ALERT_WEBHOOK_URL`, Slack/Discord-compatible
 *    JSON) so a human is paged.
 *
 * Both are fail-safe: `reportOpsEvent` and `recordJobRun` never throw, and the
 * webhook POST has a short timeout. Details are sanitized — no PII beyond a
 * uid ever leaves this module (no emails, names, birth data, tokens, bodies).
 *
 * Firebase Admin is loaded lazily so the pure helpers stay unit-testable and a
 * misconfigured service account cannot crash the caller at import time.
 */

type Env = Record<string, string | undefined>;

export type OpsSeverity = "info" | "warning" | "critical";

/** Known kinds. Free-form strings are accepted too (slugged). */
export type OpsEventKind =
  | "job_failed"
  | "job_partial_failure"
  | "job_dispatch_failed"
  | "payment_credits_not_granted"
  | "internal_auth_mismatch"
  | "email_provider_error"
  | "account_cleanup_failed"
  | "consult_reaper_failed"
  | (string & {});

export type OpsDetailValue = string | number | boolean | null | undefined;
export type OpsDetails = Record<string, OpsDetailValue>;

export interface OpsEventRecord {
  kind: string;
  severity: OpsSeverity;
  details: Record<string, string | number | boolean | null>;
  count: number;
  context: string | null;
  createdAt: Date;
  lastAt: Date;
  expiresAt: Date;
}

export interface JobRunInput {
  ok: boolean;
  processed?: number;
  failed?: number;
  skipped?: number;
  /** Short machine-readable note, e.g. "dispatched", "max_hops". */
  note?: string;
  /** Overrides the JOB_SCHEDULES interval for staleness checks. */
  intervalMs?: number;
}

export interface JobRunRecord {
  job: string;
  ok: boolean;
  processed: number;
  failed: number;
  skipped: number;
  note: string | null;
  expectedIntervalMs: number;
  lastRunAt: Date;
  lastOkAt?: Date;
}

/** Storage seam so the logic is testable without Firestore. */
export interface OpsStore {
  /**
   * Create the event. With a dedupe id, an existing doc is bumped instead and
   * "duplicate" is returned (no second page for the same incident window).
   */
  writeEvent(
    id: string | undefined,
    record: OpsEventRecord,
  ): Promise<"created" | "duplicate">;
  writeJobRun(job: string, record: JobRunRecord): Promise<void>;
}

export interface OpsDeps {
  env?: Env;
  store?: OpsStore;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface ReportOpsOptions extends OpsDeps {
  severity?: OpsSeverity;
  /**
   * Collapse repeats of the same incident into one doc + one webhook page per
   * `dedupeWindowMs` (default 1h). Use for anything that can fire in a loop
   * (per-user failures, unauthenticated probes).
   */
  dedupeKey?: string;
  dedupeWindowMs?: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Expected cadence of every scheduled job, used for staleness. A job is stale
 * when its last successful run is older than 2× its interval.
 */
export const JOB_SCHEDULES: Record<string, number> = {
  "daily-digest": DAY,
  "daily-digest-scheduler": DAY,
  "brain-nudges": HOUR,
  "brain-maintenance": DAY,
  "subscription-lapse": DAY,
  "consult-reaper": 10 * MINUTE,
  "pdf-report-reaper": 15 * MINUTE,
  "account-deletion-retry": HOUR,
};

const DEFAULT_TTL_DAYS = 30;
const WEBHOOK_TIMEOUT_MS = 3_000;
const MAX_DETAIL_KEYS = 16;
const MAX_DETAIL_CHARS = 160;
// Anything that could carry PII or secrets is dropped by key name.
const BLOCKED_DETAIL_KEY =
  /email|phone|name|dob|tob|pob|birth|address|token|secret|password|key|body|message|text|prompt|ip$/i;
const EMAIL_IN_TEXT = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;

export function slugKind(kind: string): string {
  return (
    String(kind || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "unknown"
  );
}

/** Keep only short primitive, non-PII details. `uid` is the one identity allowed. */
export function sanitizeOpsDetails(
  details: OpsDetails | undefined,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!details || typeof details !== "object") return out;
  for (const [rawKey, value] of Object.entries(details)) {
    if (Object.keys(out).length >= MAX_DETAIL_KEYS) break;
    const key = rawKey.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
    if (!key) continue;
    if (key !== "uid" && BLOCKED_DETAIL_KEY.test(key)) continue;
    if (value === undefined) continue;
    if (value === null || typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "number") {
      out[key] = Number.isFinite(value) ? value : null;
    } else if (typeof value === "string") {
      out[key] = value
        .replace(EMAIL_IN_TEXT, "[redacted]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_DETAIL_CHARS);
    }
  }
  return out;
}

export function buildOpsEventRecord(
  kind: string,
  details: OpsDetails | undefined,
  severity: OpsSeverity,
  now: Date,
  env: Env = process.env,
): OpsEventRecord {
  const ttlDays = Number(env.OPS_EVENT_TTL_DAYS) || DEFAULT_TTL_DAYS;
  return {
    kind: slugKind(kind),
    severity,
    details: sanitizeOpsDetails(details),
    count: 1,
    context: env.CONTEXT?.trim() || null,
    createdAt: now,
    lastAt: now,
    expiresAt: new Date(now.getTime() + ttlDays * DAY),
  };
}

export function buildOpsEventId(
  kind: string,
  dedupeKey: string | undefined,
  now: Date,
  windowMs = HOUR,
): string | undefined {
  if (!dedupeKey) return undefined;
  const bucket = Math.floor(now.getTime() / Math.max(windowMs, MINUTE));
  const key = String(dedupeKey)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, 80);
  return `${slugKind(kind)}__${key}__${bucket}`;
}

/** Slack (`text`) and Discord (`content`) compatible payload. */
export function buildOpsWebhookPayload(
  record: OpsEventRecord,
  env: Env = process.env,
) {
  const site = env.SITE_NAME?.trim() || "astroyou";
  const ctx = record.context ? `/${record.context}` : "";
  const parts = Object.entries(record.details)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  const text =
    `[${site}${ctx}] ${record.severity.toUpperCase()} ${record.kind}` +
    (parts ? ` — ${parts}` : "");
  return {
    text,
    content: text,
    astroyou: {
      kind: record.kind,
      severity: record.severity,
      details: record.details,
      context: record.context,
      at: record.createdAt.toISOString(),
    },
  };
}

async function postWebhook(
  record: OpsEventRecord,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const url = env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!url || !/^https:\/\//i.test(url)) return false;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOpsWebhookPayload(record, env)),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[OpsAlerts] Webhook responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[OpsAlerts] Webhook failed:",
      err instanceof Error ? err.name : "error",
    );
    return false;
  }
}

let firestoreStore: OpsStore | null = null;

async function getDefaultStore(): Promise<OpsStore> {
  if (firestoreStore) return firestoreStore;
  const { db, FieldValue } = await import("./firebase-admin.js");
  firestoreStore = {
    async writeEvent(id, record) {
      const col = db.collection("opsEvents");
      if (!id) {
        await col.add(record);
        return "created";
      }
      const ref = col.doc(id);
      try {
        await ref.create(record);
        return "created";
      } catch (err: any) {
        // 6 = ALREADY_EXISTS: same incident inside the dedupe window.
        if (err?.code !== 6 && err?.code !== "already-exists") throw err;
        await ref.update({
          count: FieldValue.increment(1),
          lastAt: record.lastAt,
        });
        return "duplicate";
      }
    },
    async writeJobRun(job, record) {
      await db.collection("jobRuns").doc(job).set(record, { merge: true });
    },
  };
  return firestoreStore;
}

/**
 * Record an operational incident. Never throws; always logs one line.
 * Returns whether the event was stored / paged (for tests and callers that
 * want to know).
 */
export async function reportOpsEvent(
  kind: OpsEventKind,
  details: OpsDetails = {},
  options: ReportOpsOptions = {},
): Promise<{ stored: boolean; paged: boolean; duplicate: boolean }> {
  const env = options.env ?? process.env;
  const now = options.now?.() ?? new Date();
  const severity = options.severity ?? "warning";
  const record = buildOpsEventRecord(kind, details, severity, now, env);
  console.error(
    `[OpsAlerts] ${record.severity} ${record.kind}`,
    JSON.stringify(record.details),
  );

  let stored = false;
  let duplicate = false;
  try {
    const store = options.store ?? (await getDefaultStore());
    const id = buildOpsEventId(
      record.kind,
      options.dedupeKey,
      now,
      options.dedupeWindowMs,
    );
    duplicate = (await store.writeEvent(id, record)) === "duplicate";
    stored = true;
  } catch (err) {
    console.error(
      "[OpsAlerts] Could not store ops event:",
      err instanceof Error ? err.name : "error",
    );
  }

  // Page once per incident window; if storage failed we still page.
  const paged = duplicate
    ? false
    : await postWebhook(record, env, options.fetchImpl ?? fetch);
  return { stored, paged, duplicate };
}

export function buildJobRunRecord(
  job: string,
  input: JobRunInput,
  now: Date,
): JobRunRecord {
  const count = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.floor(v))
      : 0;
  const record: JobRunRecord = {
    job,
    ok: Boolean(input.ok),
    processed: count(input.processed),
    failed: count(input.failed),
    skipped: count(input.skipped),
    note: input.note ? String(input.note).slice(0, 80) : null,
    expectedIntervalMs: input.intervalMs ?? JOB_SCHEDULES[job] ?? DAY,
    lastRunAt: now,
  };
  if (record.ok) record.lastOkAt = now;
  return record;
}

/**
 * Write `jobRuns/{job}` (merge, so `lastOkAt` survives a failed run) and raise
 * an ops event when the run failed outright or had per-item failures.
 * Never throws.
 */
export async function recordJobRun(
  job: string,
  input: JobRunInput,
  deps: OpsDeps = {},
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const record = buildJobRunRecord(job, input, now);
  try {
    const store = deps.store ?? (await getDefaultStore());
    await store.writeJobRun(job, record);
  } catch (err) {
    console.error(
      `[OpsAlerts] Could not record job run for ${job}:`,
      err instanceof Error ? err.name : "error",
    );
  }

  if (!record.ok) {
    await reportOpsEvent(
      "job_failed",
      {
        job,
        processed: record.processed,
        failed: record.failed,
        note: record.note,
      },
      { ...deps, severity: "critical", dedupeKey: job },
    );
  } else if (record.failed > 0) {
    await reportOpsEvent(
      "job_partial_failure",
      {
        job,
        processed: record.processed,
        failed: record.failed,
        note: record.note,
      },
      { ...deps, severity: "warning", dedupeKey: job },
    );
  }
}

/** Anything Firestore may hand back for a timestamp. */
export function toMillis(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    return d instanceof Date && Number.isFinite(d.getTime())
      ? d.getTime()
      : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export interface JobFreshness {
  job: string;
  stale: boolean;
  ok: boolean;
  lastRunAt: string | null;
  lastOkAt: string | null;
  expectedIntervalMs: number;
}

/**
 * A job is stale when its last *successful* run is older than 2× its expected
 * interval (or it has never succeeded). Jobs that never wrote a jobRuns doc
 * are not judged — they may simply not be wired yet.
 */
export function assessJobFreshness(
  runs: Array<Record<string, unknown> & { id?: string }>,
  now: Date = new Date(),
): JobFreshness[] {
  return runs.map((run) => {
    const job = String(run.job || run.id || "unknown");
    const interval =
      typeof run.expectedIntervalMs === "number" && run.expectedIntervalMs > 0
        ? run.expectedIntervalMs
        : (JOB_SCHEDULES[job] ?? DAY);
    const lastRun = toMillis(run.lastRunAt);
    const lastOk = toMillis(run.lastOkAt);
    const stale = lastOk === null || now.getTime() - lastOk > 2 * interval;
    return {
      job,
      stale,
      ok: run.ok === true,
      lastRunAt: lastRun === null ? null : new Date(lastRun).toISOString(),
      lastOkAt: lastOk === null ? null : new Date(lastOk).toISOString(),
      expectedIntervalMs: interval,
    };
  });
}
