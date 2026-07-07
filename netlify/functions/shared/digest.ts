import crypto from "crypto";

interface DigestInput {
  name?: string;
  panchang?: {
    tithi?: string;
    nakshatra?: string;
    rahu_kaal?: string;
    sunrise?: string;
    sunset?: string;
  };
  dashaInfo?: {
    currentMahadasha?: string;
    currentAntardasha?: string;
  };
  transitContext?: string;
  atman?: {
    emotionalState?: string;
    routines?: Array<{ title: string; streak?: number }>;
  };
  /** Tokenized one-click unsubscribe URL — rendered in the email footer. */
  unsubscribeUrl?: string;
}

/**
 * Secret used to HMAC unsubscribe tokens. Follows the same fail-closed idiom
 * as OTP_HASH_SECRET (see shared/otp.ts): a missing or weak secret returns
 * undefined and callers must refuse to mint/verify tokens (and skip sending
 * email rather than send one without a working unsubscribe link).
 */
export function resolveUnsubscribeSecret(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const secret = env.EMAIL_UNSUB_SECRET?.trim();
  if (!secret || secret.length < 32) return undefined;
  return secret;
}

/** HMAC-SHA256(uid) hex token binding an unsubscribe link to one user. */
export function buildUnsubscribeToken(uid: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(uid).digest("hex");
}

/** Timing-safe verification of an unsubscribe token for a uid. */
export function verifyUnsubscribeToken(
  uid: string,
  token: string,
  secret: string,
): boolean {
  if (!uid || typeof token !== "string" || token.length === 0 || !secret) {
    return false;
  }
  const expected = buildUnsubscribeToken(uid, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(token);
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

/** Absolute one-click unsubscribe URL for a user. */
export function buildUnsubscribeUrl(
  uid: string,
  secret: string,
  baseUrl: string = process.env.APP_BASE_URL || "https://astroyou.app",
): string {
  const token = buildUnsubscribeToken(uid, secret);
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/unsubscribe?uid=${encodeURIComponent(uid)}&token=${token}`;
}

export function buildDailyDigest(input: DigestInput) {
  const name = input.name || "Seeker";
  const routine = input.atman?.routines?.[0];
  const subject = `${name}, your AstroYou daily guide`;
  const lines = [
    `Namaste ${name},`,
    "",
    `Energy: ${input.atman?.emotionalState || "stable"}. Move at a pace that respects it.`,
    `Panchang: ${input.panchang?.tithi || "Tithi unknown"} with ${input.panchang?.nakshatra || "Nakshatra unknown"}.`,
    input.dashaInfo?.currentMahadasha
      ? `Dasha: ${input.dashaInfo.currentMahadasha}${input.dashaInfo.currentAntardasha ? ` / ${input.dashaInfo.currentAntardasha}` : ""}.`
      : "Dasha: no current period loaded yet.",
    input.transitContext
      ? `Transit: ${input.transitContext.split("\n")[0]}`
      : "Transit: no major transit note loaded yet.",
    input.panchang?.rahu_kaal
      ? `Careful: Rahu Kaal is ${input.panchang.rahu_kaal}.`
      : "Careful: keep major starts intentional.",
    routine
      ? `Practice: continue ${routine.title}${routine.streak ? ` (${routine.streak}-day streak)` : ""}.`
      : "Practice: set one small intention before the day gets noisy.",
    "",
    "One step: choose the most important conversation or decision today and prepare before reacting.",
  ];

  const settingsUrl = `${(process.env.APP_BASE_URL || "https://astroyou.app").replace(/\/$/, "")}/settings`;
  const textFooter = input.unsubscribeUrl
    ? `Unsubscribe instantly (no login needed): ${input.unsubscribeUrl}\nManage your daily digest: ${settingsUrl}`
    : `Manage or turn off your daily digest: ${settingsUrl}`;
  const htmlFooter = input.unsubscribeUrl
    ? `You're receiving your AstroYou daily digest. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8a86a0">Unsubscribe</a> · <a href="${settingsUrl}" style="color:#8a86a0">Manage preferences</a>.`
    : `You're receiving your AstroYou daily digest. <a href="${settingsUrl}" style="color:#8a86a0">Manage or turn this off</a>.`;
  return {
    subject,
    text: `${lines.join("\n")}\n\n${textFooter}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#f8f5ee;background:#08080d;padding:24px;border-radius:16px"><h2 style="color:#E5B96A;margin-top:0">${subject}</h2>${lines
      .slice(2)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join(
        "",
      )}<p style="color:#6b6780;font-size:12px;margin-top:24px">${htmlFooter}</p></div>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
