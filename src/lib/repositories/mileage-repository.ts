import type { SupabaseClient } from "@supabase/supabase-js";
import { MILEAGE_ELIGIBLE_STATUSES, type MileageLeg } from "@/lib/domain/mileage";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type MileageTripRow = Database["public"]["Tables"]["mileage_trips"]["Row"];
export type MileageTrip = Omit<MileageTripRow, "legs"> & { legs: MileageLeg[] };

export async function getMileageSettings(client: Client, businessId: number) {
  const result = await client.from("mileage_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (result.error) throw new Error(`Unable to load mileage settings: ${result.error.message}`);
  return result.data;
}

export async function saveMileageSettings(
  client: Client,
  values: Database["public"]["Tables"]["mileage_settings"]["Insert"],
) {
  const result = await client.from("mileage_settings").upsert(values, { onConflict: "business_id" }).select("*").single();
  if (result.error) throw new Error(`Unable to save mileage settings: ${result.error.message}`);
  return result.data;
}

export type MileageEligibleJobRow = {
  id: number;
  customer_id: number;
  status: string;
  service_address: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  scheduled_start_time: string | null;
  customers: {
    street_address: string | null; city: string | null; state: string | null; zip: string | null;
    company_name: string | null; customer_type: string; first_name: string | null; last_name: string | null;
  };
};

export async function listJobsNeedingMileageSuggestions(client: Client, businessId: number, sinceDate: string) {
  const result = await client.from("jobs")
    .select("id, customer_id, status, service_address, scheduled_date, completed_date, scheduled_start_time, customers(street_address, city, state, zip, company_name, customer_type, first_name, last_name)")
    .eq("business_id", businessId)
    .in("status", MILEAGE_ELIGIBLE_STATUSES)
    .is("archived_at", null)
    .or(`completed_date.gte.${sinceDate},scheduled_date.gte.${sinceDate}`)
    .limit(5000);
  if (result.error) throw new Error(`Unable to load jobs for mileage: ${result.error.message}`);
  return (result.data ?? []) as unknown as MileageEligibleJobRow[];
}

export async function listSuggestedJobIds(client: Client, businessId: number) {
  const result = await client.from("mileage_trip_jobs").select("job_id").eq("business_id", businessId).limit(10000);
  if (result.error) throw new Error(`Unable to load suggested mileage jobs: ${result.error.message}`);
  return new Set((result.data ?? []).map((row) => row.job_id));
}

export async function createMileageTrip(client: Client, input: {
  businessId: number; tripDate: string; kind: "job_suggested" | "manual";
  homeBaseAddress: string; destinationAddress: string; purpose: string;
  legs: MileageLeg[]; totalMiles: number; needsManualDistance: boolean;
  jobIds: number[]; createdBy: string;
}) {
  const result = await client.rpc("create_mileage_trip", {
    target_business_id: input.businessId,
    target_trip_date: input.tripDate,
    target_kind: input.kind,
    target_home_base_address: input.homeBaseAddress,
    target_destination_address: input.destinationAddress,
    target_purpose: input.purpose,
    target_legs: input.legs as unknown as Database["public"]["Tables"]["mileage_trips"]["Row"]["legs"],
    target_total_miles: input.totalMiles,
    target_needs_manual_distance: input.needsManualDistance,
    target_job_ids: input.jobIds.length ? input.jobIds : null,
    target_created_by: input.createdBy,
  });
  if (result.error) throw new Error(`Unable to create mileage trip: ${result.error.message}`);
  return result.data;
}

export async function listPendingMileageTrips(client: Client, businessId: number) {
  const result = await client.from("mileage_trips").select("*")
    .eq("business_id", businessId).is("approved_at", null)
    .order("trip_date", { ascending: true }).order("id", { ascending: true }).limit(500);
  if (result.error) throw new Error(`Unable to load pending mileage trips: ${result.error.message}`);
  return (result.data ?? []) as unknown as MileageTrip[];
}

export type AppliedLegOverride = { from: string; to: string; miles: number };

export async function approveMileageTrips(
  client: Client, businessId: number, tripIds: number[], userId: string, legOverrides: Record<string, number>,
) {
  const existing = await client.from("mileage_trips").select("id, legs").eq("business_id", businessId).in("id", tripIds);
  if (existing.error) throw new Error(`Unable to load mileage trips: ${existing.error.message}`);
  const rows = (existing.data ?? []) as unknown as { id: number; legs: MileageLeg[] }[];
  const now = new Date().toISOString();
  const appliedOverrides: AppliedLegOverride[] = [];
  for (const row of rows) {
    const legs = row.legs.map((leg) => {
      const override = legOverrides[`${row.id}:${leg.seq}`];
      if (override === undefined) return leg;
      appliedOverrides.push({ from: leg.from, to: leg.to, miles: override });
      return { ...leg, miles: override };
    });
    if (legs.some((leg) => leg.miles === null)) {
      throw new Error("Every leg needs a distance before this trip can be approved.");
    }
    const totalMiles = Math.round(legs.reduce((sum, leg) => sum + (leg.miles ?? 0), 0) * 100) / 100;
    const update = await client.from("mileage_trips").update({
      legs: legs as unknown as Database["public"]["Tables"]["mileage_trips"]["Update"]["legs"],
      total_miles: totalMiles, needs_manual_distance: false, approved_by: userId, approved_at: now,
    }).eq("business_id", businessId).eq("id", row.id);
    if (update.error) throw new Error(`Unable to approve mileage trip #${row.id}: ${update.error.message}`);
  }
  return appliedOverrides;
}

export async function createManualMileageTrip(client: Client, values: {
  businessId: number; tripDate: string; homeBaseAddress: string; destinationAddress: string;
  purpose: string; miles: number; createdBy: string;
}) {
  const legs: MileageLeg[] = [{ seq: 0, from: values.homeBaseAddress, to: values.destinationAddress, miles: values.miles, job_id: null, job_label: null }];
  return createMileageTrip(client, {
    businessId: values.businessId, tripDate: values.tripDate, kind: "manual",
    homeBaseAddress: values.homeBaseAddress, destinationAddress: values.destinationAddress,
    purpose: values.purpose, legs, totalMiles: values.miles, needsManualDistance: false,
    jobIds: [], createdBy: values.createdBy,
  });
}

export async function listApprovedMileageTripsForYear(client: Client, businessId: number, year: number) {
  const result = await client.from("mileage_trips").select("*")
    .eq("business_id", businessId).not("approved_at", "is", null)
    .gte("trip_date", `${year}-01-01`).lte("trip_date", `${year}-12-31`)
    .order("trip_date", { ascending: true }).limit(2000);
  if (result.error) throw new Error(`Unable to load mileage trips for ${year}: ${result.error.message}`);
  return (result.data ?? []) as unknown as MileageTrip[];
}
