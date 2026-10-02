import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEligibleJobs,
  buildTripCandidates,
  buildTripPurpose,
  excludeAlreadySuggested,
  groupJobsByTripDate,
  MILEAGE_BACKFILL_START_DATE,
  normalizeMileageSettings,
  type MileageLeg,
} from "@/lib/domain/mileage";
import {
  createMileageTrip,
  getMileageSettings,
  listJobsNeedingMileageSuggestions,
  listSuggestedJobIds,
} from "@/lib/repositories/mileage-repository";
import type { Database } from "@/types/database";
import { resolveDistance } from "./mileage-distance";

type Client = SupabaseClient<Database>;

const LOOKUP_BUDGET_PER_RUN = 15;

export async function generateMileageSuggestions(client: Client, businessId: number, createdBy: string, options?: { maxLookups?: number }) {
  const maxLookups = options?.maxLookups ?? LOOKUP_BUDGET_PER_RUN;
  const settings = normalizeMileageSettings(await getMileageSettings(client, businessId));
  if (!settings.home_base_address) return { created: 0, lookupsUsed: 0, stoppedEarly: false, skipped: "home_base_not_set" as const };

  const [jobRows, suggestedJobIds] = await Promise.all([
    listJobsNeedingMileageSuggestions(client, businessId, MILEAGE_BACKFILL_START_DATE),
    listSuggestedJobIds(client, businessId),
  ]);
  const customersById = new Map(jobRows.map((job) => [job.customer_id, job.customers]));
  const eligible = excludeAlreadySuggested(buildEligibleJobs(jobRows, customersById), suggestedJobIds);
  const candidates = buildTripCandidates(groupJobsByTripDate(eligible), settings.home_base_address);

  let created = 0;
  let lookupsUsed = 0;
  let stoppedEarly = false;

  for (const candidate of candidates) {
    if (lookupsUsed >= maxLookups) {
      stoppedEarly = true;
      break;
    }
    const legs: MileageLeg[] = [];
    let needsManualDistance = false;
    for (const leg of candidate.legs) {
      const resolved = await resolveDistance(client, businessId, leg.from, leg.to);
      if (resolved.source !== "cache") lookupsUsed += 1;
      if (resolved.miles === null) needsManualDistance = true;
      legs.push({ seq: leg.seq, from: leg.from, to: leg.to, miles: resolved.miles, job_id: leg.jobId, job_label: leg.jobLabel });
    }
    const totalMiles = Math.round(legs.reduce((sum, leg) => sum + (leg.miles ?? 0), 0) * 100) / 100;
    try {
      await createMileageTrip(client, {
        businessId,
        tripDate: candidate.tripDate,
        kind: "job_suggested",
        homeBaseAddress: settings.home_base_address,
        destinationAddress: legs[legs.length - 1].to,
        purpose: buildTripPurpose(candidate.jobs),
        legs,
        totalMiles,
        needsManualDistance,
        jobIds: candidate.jobs.map((job) => job.id),
        createdBy,
      });
      created += 1;
    } catch (error) {
      // A concurrent request may have already suggested one of these jobs; skip and keep going.
      console.error("Skipping mileage trip candidate after create failure", { businessId, tripDate: candidate.tripDate, error });
    }
  }

  return { created, lookupsUsed, stoppedEarly };
}
