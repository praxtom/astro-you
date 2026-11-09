/** Shared by React and prerendering so URLs and search snippets stay aligned. */
export const PRIVATE_ROUTES = [
  '/onboarding', '/synthesis', '/dashboard', '/transit', '/forecast',
  '/compatibility', '/consult', '/wallet', '/reports', '/remedies', '/payment',
  '/settings', '/admin', '/today', '/guidance', '/chart', '/bonds', '/path',
];
export function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTES.some(route => path === route || path.startsWith(`${route}/`));
}
export function panchangRoute(date?: string) {
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) return null;
  return { date, path: date ? `/panchang/${date}` : '/panchang',
    title: date ? `Panchang ${date}: Tithi & Timings` : 'Today Panchang: Tithi & Timings' };
}
const MUHURAT: Record<string, { purpose: string; title: string }> = {
  business: { purpose: 'business', title: 'Business Muhurat' },
  marriage: { purpose: 'marriage', title: 'Marriage Muhurat' },
  property: { purpose: 'home', title: 'Property Muhurat' },
  travel: { purpose: 'travel', title: 'Travel Muhurat' },
};
export function muhuratRoute(category?: string) {
  if (category && !Object.prototype.hasOwnProperty.call(MUHURAT, category)) return null;
  return { ...(category ? MUHURAT[category] : { purpose: 'business', title: 'Free Muhurat Finder' }),
    path: category ? `/muhurat/${category}` : '/muhurat' };
}
const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const PERIODS = ['daily','weekly','monthly','yearly'];
export function horoscopeRoute(sign?: string, period?: string) {
  if (!sign || !SIGNS.includes(sign) || (period && !PERIODS.includes(period))) return null;
  const name = sign[0].toUpperCase() + sign.slice(1);
  return { path: `/horoscope/${sign}${period ? `/${period}` : ''}`,
    title: `${name}${period ? ` ${period[0].toUpperCase()}${period.slice(1)}` : ''} Horoscope` };
}
export function searchTitle(value: string): string {
  let title = value.replace(/\s*\|\s*AstroYou$/i, '').trim();
  // Drop a verbose subtitle, never the topic (e.g. planet + house or date).
  if (title.length > 49) title = title.split(/:\s|\s[—–|]\s/)[0];
  return `${title} | AstroYou`;
}
export function searchDescription(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= 160) return text;
  const sentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  if (sentence && sentence.length >= 70 && sentence.length <= 160) return sentence;
  return `${text.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:]$/, '')}…`;
}
