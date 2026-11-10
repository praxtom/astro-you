import { useEffect, useState } from "react";

export type PlaceCoordinates = { lat: number; lng: number };

const CACHE_PREFIX = "astroyou.placeCoords.v1:";

function readCache(place: string): PlaceCoordinates | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + place.toLowerCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlaceCoordinates>;
    return isValid(parsed) ? { lat: parsed.lat!, lng: parsed.lng! } : null;
  } catch {
    return null;
  }
}

function writeCache(place: string, coords: PlaceCoordinates): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + place.toLowerCase(),
      JSON.stringify(coords),
    );
  } catch {
    // Storage full or blocked: the lookup simply runs again next visit.
  }
}

function isValid(v: Partial<PlaceCoordinates> | null | undefined): boolean {
  return (
    !!v &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lat!) <= 90 &&
    Math.abs(v.lng!) <= 180
  );
}

/**
 * Coordinates for a typed place name ("Pune, Maharashtra"), looked up once
 * with the same geocoder the location field uses and cached in this browser.
 *
 * For location-only uses such as panchang timings. It never writes the
 * profile's birth coordinates: the chart keeps the astrology API's own
 * geocoding, so an approximate point here can't move the rising sign.
 *
 * `pending` is true while a lookup is in flight, so callers can wait instead
 * of fetching data for a default place first.
 */
export function usePlaceCoordinates(place: string | undefined) {
  const query = place?.trim() ?? "";
  const [state, setState] = useState<{
    query: string;
    coords: PlaceCoordinates | null;
    done: boolean;
  }>(() => {
    const cached = query ? readCache(query) : null;
    return { query, coords: cached, done: !query || Boolean(cached) };
  });

  useEffect(() => {
    if (!query) {
      setState({ query, coords: null, done: true });
      return;
    }
    const cached = readCache(query);
    if (cached) {
      setState({ query, coords: cached, done: true });
      return;
    }
    setState({ query, coords: null, done: false });

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        const first = Array.isArray(data) ? data[0] : null;
        const coords = first
          ? { lat: Number(first.lat), lng: Number(first.lon) }
          : null;
        if (coords && isValid(coords)) {
          writeCache(query, coords);
          setState({ query, coords, done: true });
        } else {
          setState({ query, coords: null, done: true });
        }
      })
      .catch(() => {
        // Network error or the 6s timeout: fall back to the default place.
        if (!cancelled) setState({ query, coords: null, done: true });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const current = state.query === query;
  return {
    coords: current ? state.coords : null,
    pending: Boolean(query) && (!current || !state.done),
  };
}
