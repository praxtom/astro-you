import type { UserProfile } from "../types";

export type PlatformLanguageCode = NonNullable<UserProfile["language"]>;

export interface PlatformLanguage {
  code: PlatformLanguageCode;
  label: string;
  nativeLabel: string;
}

export const PLATFORM_LANGUAGES: PlatformLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
];

export function normalizePlatformLanguage(value: unknown): PlatformLanguageCode {
  return PLATFORM_LANGUAGES.some((language) => language.code === value)
    ? (value as PlatformLanguageCode)
    : "en";
}

export function getPlatformLanguage(value: unknown): PlatformLanguage {
  const code = normalizePlatformLanguage(value);
  return PLATFORM_LANGUAGES.find((language) => language.code === code) || PLATFORM_LANGUAGES[0];
}
