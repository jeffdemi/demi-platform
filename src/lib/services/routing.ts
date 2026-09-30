import "server-only";

import type { GeocodeResult } from "./geocoding";

const METERS_PER_MILE = 1609.344;

export async function routeDistanceMiles(origin: GeocodeResult, destination: GeocodeResult): Promise<number | null> {
  try {
    const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      console.error("OSRM route request failed", { status: response.status });
      return null;
    }
    const body = await response.json().catch(() => null) as { routes?: { distance?: number }[] } | null;
    const meters = body?.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
    return Math.round((meters / METERS_PER_MILE) * 100) / 100;
  } catch (error) {
    console.error("OSRM route request errored", { error });
    return null;
  }
}
