import { auth, db } from "./firebase-admin.js";
import {
  buildDailyDigest,
  buildUnsubscribeUrl,
  hasDigestOptIn,
  resolveUnsubscribeSecret,
} from "./digest.js";
import { resolveResendApiKey } from "./env.js";
import { describeError } from "./error-summary.js";
import { reportOpsEvent } from "./ops-alerts.js";
import { processUsersPaged } from "./scheduled-users.js";
import { buildUserContext } from "./user-context.js";
import { lookupVerifiedAuthEmail } from "./verified-contact.js";

const RESEND_TIMEOUT_MS = 10_000;

export interface DailyDigestRunResult {
  uid: string;
  subject?: string;
  text?: string;
  html?: string;
  emailSent: boolean;
  skippedReason?: string;
}

export async function generateDailyDigestForUser(input: {
  uid: string;
  sendEmail: boolean;
  channel: "preview" | "email" | "scheduled_email";
}): Promise<DailyDigestRunResult> {
  const userSnap = await db.collection("users").doc(input.uid).get();
  const userData = userSnap.data() || {};
  const profile = userData.profile || userData;
  const prefs = profile.notificationPrefs || userData.notificationPrefs || {};

  if (input.sendEmail && prefs.emailDigest === false) {
    return {
      uid: input.uid,
      emailSent: false,
      skippedReason: "email_digest_disabled",
    };
  }
  // The scheduled (bulk) path is opt-in only: no explicit `emailDigest: true`,
  // no email. A user-initiated "email me today's digest" stays allowed unless
  // they turned the digest off.
  if (input.channel === "scheduled_email" && !hasDigestOptIn(userData)) {
    return {
      uid: input.uid,
      emailSent: false,
      skippedReason: "email_digest_not_opted_in",
    };
  }

  // The recipient is the verified email on the Firebase Auth record — never
  // caller input, and never the owner-writable user doc (`email`,
  // `profile.email`), which would let anyone point our cron at a victim's
  // inbox. Only resolved when we would actually send.
  const email = input.sendEmail
    ? await lookupVerifiedAuthEmail(input.uid, (uid) => auth.getUser(uid))
    : null;
  const resendApiKey = resolveResendApiKey();
  const unsubscribeSecret = resolveUnsubscribeSecret();

  // Fail fast BEFORE building user context: context building makes paid
  // astrology API calls, so a user we can't email must not cost anything and
  // must not get a digests doc written.
  if (input.sendEmail) {
    if (!email) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_email",
      };
    }
    if (!resendApiKey) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_email_provider",
      };
    }
    // Compliance fail-closed: never send a marketing/bulk email without a
    // working one-click unsubscribe (Gmail/Yahoo bulk-sender requirement).
    if (!unsubscribeSecret) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_unsubscribe_secret",
      };
    }
  }

  // Idempotency for the scheduled path: one digest per user per UTC day. If the
  // cron double-fires, we skip re-sending instead of emailing twice.
  const dateStr = new Date().toISOString().split("T")[0];
  const digestsCol = db
    .collection("users")
    .doc(input.uid)
    .collection("digests");
  const idempotent = input.channel === "scheduled_email";
  const digestRef = idempotent
    ? digestsCol.doc(`${dateStr}`)
    : digestsCol.doc();
  if (idempotent) {
    const existing = await digestRef.get();
    if (existing.exists && existing.data()?.emailSent) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "already_sent_today",
      };
    }
  }

  // Gmail/Yahoo bulk-sender compliance: every email carries a tokenized
  // one-click unsubscribe URL (header + visible footer link, no login needed).
  const unsubscribeUrl = unsubscribeSecret
    ? buildUnsubscribeUrl(input.uid, unsubscribeSecret)
    : undefined;

  const { userContext } = await buildUserContext({ uid: input.uid });
  const digest = buildDailyDigest({
    name: userContext.name || profile.name || "Seeker",
    panchang: userContext.panchangData,
    dashaInfo: userContext.dashaInfo,
    transitContext: userContext.transitContext,
    atman: userContext.atman || userData.atman,
    unsubscribeUrl,
  });

  let emailSent = false;
  let skippedReason: string | undefined;
  if (input.sendEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        // Resend dedupes retries carrying the same key.
        "Idempotency-Key": `digest_${input.uid}_${dateStr}`,
      },
      body: JSON.stringify({
        from:
          process.env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
        to: email,
        subject: digest.subject,
        html: digest.html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    }).catch((err: unknown) => {
      // Timeout / network: treated as a provider error. A retry reuses the
      // same Idempotency-Key, so Resend will not double-send.
      return {
        ok: false,
        status:
          err instanceof Error && err.name === "TimeoutError"
            ? "timeout"
            : "network",
      } as const;
    });
    emailSent = response.ok;
    if (!response.ok) {
      skippedReason = `email_provider_${response.status}`;
    }
  }

  await digestRef.set({
    channel: input.channel,
    emailSent,
    skippedReason: skippedReason || null,
    subject: digest.subject,
    text: digest.text,
    createdAt: new Date(),
  });

  return {
    uid: input.uid,
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
    emailSent,
    skippedReason,
  };
}

export interface DigestBatchTotals {
  processed: number;
  emailSent: number;
  skipped: number;
  failed: number;
  providerErrors: number;
}

export const EMPTY_DIGEST_TOTALS: DigestBatchTotals = {
  processed: 0,
  emailSent: 0,
  skipped: 0,
  failed: 0,
  providerErrors: 0,
};

export function addDigestTotals(
  a: Partial<DigestBatchTotals> | undefined,
  b: Partial<DigestBatchTotals>,
): DigestBatchTotals {
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  return {
    processed: n(a?.processed) + n(b.processed),
    emailSent: n(a?.emailSent) + n(b.emailSent),
    skipped: n(a?.skipped) + n(b.skipped),
    failed: n(a?.failed) + n(b.failed),
    providerErrors: n(a?.providerErrors) + n(b.providerErrors),
  };
}

/** Cursor job name shared by the background run and the inline fallback. */
export const DAILY_DIGEST_CURSOR_JOB = "daily-digest-run";

/**
 * One slice of the scheduled daily digest: walks users from the per-day
 * cursor until the deadline, emailing only users who explicitly opted in.
 * Per-user idempotency (digests/{date}) and the Resend Idempotency-Key make a
 * re-run or overlapping slice safe.
 */
export async function runDailyDigestSlice(input: {
  runDate: string;
  deadlineMs: number;
  maxUsers?: number;
  concurrency?: number;
}): Promise<
  DigestBatchTotals & { reachedEnd: boolean; alreadyCompleted: boolean }
> {
  const totals: DigestBatchTotals = { ...EMPTY_DIGEST_TOTALS };
  const providerStatuses = new Set<string>();

  const result = await processUsersPaged(
    {
      job: DAILY_DIGEST_CURSOR_JOB,
      runKey: input.runDate,
      deadlineMs: input.deadlineMs,
      maxUsers: input.maxUsers ?? 100_000,
      concurrency: input.concurrency ?? 1,
    },
    async (userDoc) => {
      const data = userDoc.data();
      // Cheap pre-filter on the already-loaded doc: non-opted-in users cost
      // no extra reads, Auth lookups, or astrology calls.
      if (!hasDigestOptIn(data)) {
        totals.skipped += 1;
        return;
      }
      try {
        const res = await generateDailyDigestForUser({
          uid: userDoc.id,
          sendEmail: true,
          channel: "scheduled_email",
        });
        if (res.emailSent) {
          totals.emailSent += 1;
        } else {
          totals.skipped += 1;
          if (res.skippedReason?.startsWith("email_provider_")) {
            totals.providerErrors += 1;
            providerStatuses.add(
              res.skippedReason.slice("email_provider_".length),
            );
          }
        }
      } catch (err) {
        totals.failed += 1;
        console.error(
          "[DailyDigest] User failed:",
          userDoc.id,
          describeError(err),
        );
      }
    },
  );
  totals.processed = result.processed;

  if (totals.providerErrors > 0) {
    await reportOpsEvent(
      "email_provider_error",
      {
        job: "daily-digest",
        provider: "resend",
        errors: totals.providerErrors,
        statuses: [...providerStatuses].slice(0, 5).join(","),
        runDate: input.runDate,
      },
      { severity: "critical", dedupeKey: `daily-digest-${input.runDate}` },
    );
  }

  return {
    ...totals,
    reachedEnd: result.reachedEnd,
    alreadyCompleted: Boolean(result.alreadyCompleted),
  };
}
