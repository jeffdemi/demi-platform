import "server-only";

export type GeocodeResult = { lat: number; lon: number };

function userAgent() {
  // Nominatim's usage policy requires an identifying User-Agent. What identifies
  // the caller is the owner's decision, made via env, not a default we guess for him.
  return process.env.NOMINATIM_USER_AGENT?.trim() || "demi-platform-mileage-tool";
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Nominatim geocode request failed", { status: response.status, address });
      return null;
    }
    const results = await response.json().catch(() => null) as { lat?: string; lon?: string }[] | null;
    const first = results?.[0];
    if (!first?.lat || !first.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (error) {
    console.error("Nominatim geocode request errored", { address, error });
    return null;
  }
}
