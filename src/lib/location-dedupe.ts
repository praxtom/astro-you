/**
 * Geocoder (Nominatim) searches often return the same city several times —
 * once as a node, once as a boundary relation, once as a suburb centroid. They
 * share a display name, or sit within a few hundred metres of each other.
 * Collapse those so the dropdown shows each place once.
 */
export interface DedupableLocation {
  display_name: string;
  lat: string | number;
  lon: string | number;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Coordinates rounded to 2 decimals (~1 km) — close enough to be one place. */
function coordinateKey(lat: string | number, lon: string | number): string | null {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return `${la.toFixed(2)},${lo.toFixed(2)}`;
}

export function dedupeLocationSuggestions<T extends DedupableLocation>(
  items: readonly T[],
): T[] {
  const seenNames = new Set<string>();
  const seenCoords = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item || typeof item.display_name !== "string") continue;
    const nameKey = normalizeName(item.display_name);
    const coordKey = coordinateKey(item.lat, item.lon);
    if (seenNames.has(nameKey)) continue;
    if (coordKey && seenCoords.has(coordKey)) continue;
    seenNames.add(nameKey);
    if (coordKey) seenCoords.add(coordKey);
    out.push(item);
  }
  return out;
}
