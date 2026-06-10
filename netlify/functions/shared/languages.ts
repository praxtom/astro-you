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
  return PLATFORM_LANGUAGES.find((language) => language.code === code) || PLATFORM_LANGUAGES[0];
}

export function buildResponseLanguageInstruction(value: unknown): string {
  const language = getPlatformLanguage(value);
  return `Preferred response language: ${language.label}. ${language.responseInstruction}`;
}
