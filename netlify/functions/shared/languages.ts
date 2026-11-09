export type PlatformLanguageCode = "en" | "hi" | "ta" | "te" | "bn" | "mr";

export interface PlatformLanguage {
  code: PlatformLanguageCode;
  label: string;
  nativeLabel: string;
  responseInstruction: string;
}

export const PLATFORM_LANGUAGES: PlatformLanguage[] = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    responseInstruction: "Respond in English.",
  },
  {
    code: "hi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    responseInstruction:
      "Respond primarily in Hindi using Devanagari script. Keep Sanskrit astrology terms readable and briefly explain difficult words.",
  },
  {
    code: "ta",
    label: "Tamil",
    nativeLabel: "தமிழ்",
    responseInstruction:
      "Respond primarily in Tamil. Keep Sanskrit astrology terms readable and briefly explain difficult words.",
  },
  {
    code: "te",
    label: "Telugu",
    nativeLabel: "తెలుగు",
    responseInstruction:
      "Respond primarily in Telugu. Keep Sanskrit astrology terms readable and briefly explain difficult words.",
  },
  {
    code: "bn",
    label: "Bengali",
    nativeLabel: "বাংলা",
    responseInstruction:
      "Respond primarily in Bengali. Keep Sanskrit astrology terms readable and briefly explain difficult words.",
  },
  {
    code: "mr",
    label: "Marathi",
    nativeLabel: "मराठी",
    responseInstruction:
      "Respond primarily in Marathi using Devanagari script. Keep Sanskrit astrology terms readable and briefly explain difficult words.",
  },
];

export function normalizePlatformLanguage(
  value: unknown,
  fallback: PlatformLanguageCode = "en",
): PlatformLanguageCode {
  return PLATFORM_LANGUAGES.some((language) => language.code === value)
    ? (value as PlatformLanguageCode)
    : fallback;
}

export function getPlatformLanguage(value: unknown): PlatformLanguage {
  const code = normalizePlatformLanguage(value);
  return (
    PLATFORM_LANGUAGES.find((language) => language.code === code) ||
    PLATFORM_LANGUAGES[0]
  );
}

/**
 * Chat language rule: mirror the language AND script of the user's latest
 * message (Hinglish → Hinglish, Devanagari Hindi → Devanagari Hindi); the
 * profile language is only the fallback when the message gives no signal.
 */
export function buildResponseLanguageInstruction(value: unknown): string {
  const language = getPlatformLanguage(value);
  return `Reply in the same language and script the user writes their latest message in. Hinglish (Hindi typed in Roman letters) gets a Hinglish reply in Roman letters; Hindi in Devanagari gets Devanagari Hindi; English gets English; the same for any other language. If they mix Hindi and English, mix the same way. Only when the message gives no clear signal (e.g. "ok", an emoji, a name) use their profile language, ${language.label}: ${language.responseInstruction}`;
}
