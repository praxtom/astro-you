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
    input.panchang?.rahu_kaal ? `Careful: Rahu Kaal is ${input.panchang.rahu_kaal}.` : "Careful: keep major starts intentional.",
    routine
      ? `Practice: continue ${routine.title}${routine.streak ? ` (${routine.streak}-day streak)` : ""}.`
      : "Practice: set one small intention before the day gets noisy.",
    "",
    "One step: choose the most important conversation or decision today and prepare before reacting.",
  ];

  return {
    subject,
    text: lines.join("\n"),
    html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#f8f5ee;background:#08080d;padding:24px;border-radius:16px"><h2 style="color:#E5B96A;margin-top:0">${subject}</h2>${lines
      .slice(2)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}</div>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
