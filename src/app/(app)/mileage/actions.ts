"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { generateMileageSuggestions } from "@/lib/services/mileage-generation";
import { recordManualDistanceCorrection, resolveDistance } from "@/lib/services/mileage-distance";
import {
  approveMileageTrips as approveMileageTripsRepo,
  createManualMileageTrip,
  getMileageSettings,
  saveMileageSettings as saveMileageSettingsRepo,
} from "@/lib/repositories/mileage-repository";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  manualMileageTripSchema,
  mileageDistanceCorrectionSchema,
  mileageSettingsSchema,
  mileageTripApprovalSchema,
} from "@/lib/validation/business-records";

export type MileageState = { message?: string; errors?: Record<string, string[]>; values?: Record<string, string> };

function refreshMileage() {
  revalidatePath("/mileage");
  revalidatePath("/mileage/report");
}

export async function saveMileageSettings(_: MileageState, formData: FormData): Promise<MileageState> {
  const restore = { values: { homeBaseAddress: String(formData.get("homeBaseAddress") ?? ""), irsStandardMileageRate: String(formData.get("irsStandardMileageRate") ?? "") } };
  const parsed = mileageSettingsSchema.safeParse(formValues(formData, ["homeBaseAddress", "irsStandardMileageRate"]));
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee" || context.role === "intern") return { ...restore, message: "Only an owner or administrator can change mileage settings." };
  try {
    await saveMileageSettingsRepo(await createClient(), {
      business_id: context.business.id,
      home_base_address: parsed.data.homeBaseAddress,
      irs_standard_mileage_rate: parsed.data.irsStandardMileageRate ?? null,
    });
    refreshMileage();
    return { message: "Mileage settings saved." };
  } catch (error) {
    return { ...restore, message: error instanceof Error ? error.message : "Mileage settings could not be saved." };
  }
}

export async function generateMileageSuggestionsNow(_state: MileageState): Promise<MileageState> {
  void _state;
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  try {
    const client = await createClient();
    const result = await generateMileageSuggestions(client, context.business.id, context.user.id);
    if (result.skipped === "home_base_not_set") return { message: "Set your home base address first." };
    refreshMileage();
    if (!result.created) return { message: "No new trips to suggest right now." };
    return { message: `Suggested ${result.created} trip${result.created === 1 ? "" : "s"}.${result.stoppedEarly ? " More remain -- run this again to continue." : ""}` };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Could not generate mileage suggestions." };
  }
}

export async function approveMileageTrips(_: MileageState, formData: FormData): Promise<MileageState> {
  const tripIds = formData.getAll("tripIds").map(Number);
  const parsed = mileageTripApprovalSchema.safeParse({ tripIds });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const legOverrides: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("distance:")) continue;
    const miles = Number(value);
    if (Number.isFinite(miles) && miles >= 0) legOverrides[key.slice("distance:".length)] = miles;
  }
  try {
    const client = await createClient();
    const appliedOverrides = await approveMileageTripsRepo(client, context.business.id, parsed.data.tripIds, context.user.id, legOverrides);
    for (const override of appliedOverrides) {
      await recordManualDistanceCorrection(client, context.business.id, override.from, override.to, override.miles, context.user.id);
    }
    refreshMileage();
    return { message: `Approved ${parsed.data.tripIds.length} trip${parsed.data.tripIds.length === 1 ? "" : "s"}.` };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Could not approve the selected trips." };
  }
}

export async function saveManualMileageTrip(_: MileageState, formData: FormData): Promise<MileageState> {
  const restore = { values: { tripDate: String(formData.get("tripDate") ?? ""), destination: String(formData.get("destination") ?? ""), purpose: String(formData.get("purpose") ?? ""), manualMiles: String(formData.get("manualMiles") ?? "") } };
  const parsed = manualMileageTripSchema.safeParse(formValues(formData, ["tripDate", "destination", "purpose", "manualMiles"]));
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { ...restore, message: "Interns have read-only access." };
  const client = await createClient();
  const settings = await getMileageSettings(client, context.business.id);
  const homeBaseAddress = settings?.home_base_address?.trim();
  if (!homeBaseAddress) return { ...restore, message: "Set your home base address first." };
  try {
    let miles = parsed.data.manualMiles ?? null;
    if (miles === null) {
      const resolved = await resolveDistance(client, context.business.id, homeBaseAddress, parsed.data.destination);
      miles = resolved.miles;
    }
    if (miles === null) {
      return { ...restore, errors: { manualMiles: ["Could not look up this distance automatically -- enter the miles for this trip."] } };
    }
    await createManualMileageTrip(client, {
      businessId: context.business.id, tripDate: parsed.data.tripDate as string, homeBaseAddress,
      destinationAddress: parsed.data.destination, purpose: parsed.data.purpose, miles, createdBy: context.user.id,
    });
    if (parsed.data.manualMiles !== undefined) {
      await recordManualDistanceCorrection(client, context.business.id, homeBaseAddress, parsed.data.destination, miles, context.user.id);
    }
    refreshMileage();
    return { message: "Trip recorded." };
  } catch (error) {
    return { ...restore, message: error instanceof Error ? error.message : "The trip could not be saved." };
  }
}

export async function correctMileageDistance(_: MileageState, formData: FormData): Promise<MileageState> {
  const parsed = mileageDistanceCorrectionSchema.safeParse(formValues(formData, ["tripId", "seq", "miles"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  try {
    const client = await createClient();
    const tripId = parsed.data.tripId as number;
    const appliedOverrides = await approveMileageTripsRepo(
      client, context.business.id, [tripId], context.user.id,
      { [`${tripId}:${parsed.data.seq}`]: parsed.data.miles as number },
    );
    for (const override of appliedOverrides) {
      await recordManualDistanceCorrection(client, context.business.id, override.from, override.to, override.miles, context.user.id);
    }
    refreshMileage();
    return { message: "Distance corrected." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Could not correct this distance." };
  }
}
