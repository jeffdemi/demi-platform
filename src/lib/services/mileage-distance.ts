import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAddressQuery } from "@/lib/domain/mileage";
import type { Database } from "@/types/database";
import { geocodeAddress, type GeocodeResult } from "./geocoding";
import { throttled } from "./mileage-rate-limit";
import { routeDistanceMiles } from "./routing";

type Client = SupabaseClient<Database>;

export async function resolveGeocode(client: Client, businessId: number, address: string): Promise<GeocodeResult | null> {
  const normalizedQuery = normalizeAddressQuery(address);
  const cached = await client.from("mileage_geocode_cache").select("latitude, longitude, lookup_status")
    .eq("business_id", businessId).eq("normalized_query", normalizedQuery).maybeSingle();
  if (cached.error) throw new Error(`Unable to load geocode cache: ${cached.error.message}`);
  if (cached.data) {
    if (cached.data.lookup_status === "failed" || cached.data.latitude === null || cached.data.longitude === null) return null;
    return { lat: cached.data.latitude, lon: cached.data.longitude };
  }

  const result = await throttled(() => geocodeAddress(address));
  const upsert = await client.from("mileage_geocode_cache").upsert({
    business_id: businessId,
    normalized_query: normalizedQuery,
    address_text: address,
    latitude: result?.lat ?? null,
    longitude: result?.lon ?? null,
    lookup_status: result ? "ok" : "failed",
  }, { onConflict: "business_id,normalized_query" });
  if (upsert.error) throw new Error(`Unable to save geocode cache: ${upsert.error.message}`);
  return result;
}

export type ResolvedDistance = { miles: number | null; source: "cache" | "osrm" | "failed" };

export async function resolveDistance(client: Client, businessId: number, origin: string, destination: string): Promise<ResolvedDistance> {
  const originQuery = normalizeAddressQuery(origin);
  const destinationQuery = normalizeAddressQuery(destination);
  const cached = await client.from("mileage_distance_cache").select("miles")
    .eq("business_id", businessId).eq("origin_query", originQuery).eq("destination_query", destinationQuery).maybeSingle();
  if (cached.error) throw new Error(`Unable to load distance cache: ${cached.error.message}`);
  if (cached.data) return { miles: cached.data.miles, source: "cache" };

  const [originGeocode, destinationGeocode] = await Promise.all([
    resolveGeocode(client, businessId, origin),
    resolveGeocode(client, businessId, destination),
  ]);
  if (!originGeocode || !destinationGeocode) return { miles: null, source: "failed" };

  const miles = await throttled(() => routeDistanceMiles(originGeocode, destinationGeocode));
  if (miles === null) return { miles: null, source: "failed" };

  const upsert = await client.from("mileage_distance_cache").upsert({
    business_id: businessId, origin_query: originQuery, destination_query: destinationQuery,
    miles, distance_source: "osrm",
  }, { onConflict: "business_id,origin_query,destination_query" });
  if (upsert.error) throw new Error(`Unable to save distance cache: ${upsert.error.message}`);
  return { miles, source: "osrm" };
}

export async function recordManualDistanceCorrection(
  client: Client, businessId: number, origin: string, destination: string, miles: number, userId: string,
) {
  const result = await client.from("mileage_distance_cache").upsert({
    business_id: businessId,
    origin_query: normalizeAddressQuery(origin),
    destination_query: normalizeAddressQuery(destination),
    miles, distance_source: "manual_correction", corrected_by: userId, corrected_at: new Date().toISOString(),
  }, { onConflict: "business_id,origin_query,destination_query" });
  if (result.error) throw new Error(`Unable to save distance correction: ${result.error.message}`);
}
