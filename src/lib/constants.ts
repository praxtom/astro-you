/**
 * Centralized constants for AstroYou
 * Prevents magic strings scattered across the codebase
 */

// localStorage & sessionStorage keys
export const STORAGE_KEYS = {
  PROFILE: 'astroyou_profile',
  PROFILE_COMPLETE: 'astroyou_profile_complete',
  MODE: 'astroyou_mode',
  FREE_SECONDS: 'astroyou_free_seconds',
  GUEST_PROFILE: 'astroyou_guest_profile',
  GUEST_COMPLETE: 'astroyou_guest_complete',
  LOGIN_REDIRECT: 'astroyou_login_redirect',
} as const;

// Relationship form options
export const RELATIONS = ['partner', 'parent', 'child', 'boss', 'friend'] as const;
export const DYNAMICS = ['supportive', 'conflict', 'distant', 'teacher'] as const;
export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

// Free tier limits
export const FREE_LIMIT_SECONDS = 600; // 10 minutes
