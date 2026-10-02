import { customerAddressLine, customerDisplayName, type Customer } from "./customers";
import type { Job } from "./jobs";

export const MILEAGE_ELIGIBLE_STATUSES = ["completed", "invoiced", "paid"] as const;
export const MILEAGE_BACKFILL_START_DATE = "2026-01-01";

type MileageJob = Pick<Job, "id" | "customer_id" | "status" | "service_address" | "scheduled_date" | "completed_date" | "scheduled_start_time">;
type MileageCustomer = Pick<Customer, "street_address" | "city" | "state" | "zip" | "company_name" | "customer_type" | "first_name" | "last_name">;

export type EligibleJob = { id: number; date: string; address: string; scheduledStartTime: string | null; label: string };
export type TripLegDraft = { seq: number; from: string; to: string; jobId: number | null; jobLabel: string | null };
export type TripCandidate = { tripDate: string; jobs: EligibleJob[]; legs: TripLegDraft[] };
export type MileageLeg = { seq: number; from: string; to: string; miles: number | null; job_id: number | null; job_label: string | null };
export type ReportLegRow = { date: string; origin: string; destination: string; miles: number; purpose: string };

export function effectiveJobDate(job: Pick<MileageJob, "completed_date" | "scheduled_date">) {
  return job.completed_date ?? job.scheduled_date ?? null;
}

export function resolveJobAddress(job: Pick<MileageJob, "service_address">, customer: MileageCustomer | null | undefined) {
  const jobAddress = job.service_address?.trim();
  if (jobAddress) return jobAddress;
  return (customer && customerAddressLine(customer)) || null;
}

export function normalizeAddressQuery(address: string) {
  return address.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

export function buildEligibleJobs(jobs: MileageJob[], customersById: Map<number, MileageCustomer>): EligibleJob[] {
  const eligibleStatuses = new Set<string>(MILEAGE_ELIGIBLE_STATUSES);
  const eligible: EligibleJob[] = [];
  for (const job of jobs) {
    if (!eligibleStatuses.has(job.status)) continue;
    const date = effectiveJobDate(job);
    if (!date) continue;
    const customer = customersById.get(job.customer_id);
    const address = resolveJobAddress(job, customer);
    if (!address) continue;
    eligible.push({
      id: job.id,
      date,
      address,
      scheduledStartTime: job.scheduled_start_time,
      label: customer ? `Job #${job.id} (${customerDisplayName(customer)})` : `Job #${job.id}`,
    });
  }
  return eligible;
}

export function excludeAlreadySuggested(jobs: EligibleJob[], suggestedJobIds: Set<number>) {
  return jobs.filter((job) => !suggestedJobIds.has(job.id));
}

export function groupJobsByTripDate(jobs: EligibleJob[]) {
  const groups = new Map<string, EligibleJob[]>();
  for (const job of jobs) {
    const list = groups.get(job.date);
    if (list) list.push(job);
    else groups.set(job.date, [job]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (a.scheduledStartTime !== null && b.scheduledStartTime !== null) return a.scheduledStartTime.localeCompare(b.scheduledStartTime);
      if (a.scheduledStartTime !== null) return -1;
      if (b.scheduledStartTime !== null) return 1;
      return a.id - b.id;
    });
  }
  return groups;
}

export function buildTripCandidates(groups: Map<string, EligibleJob[]>, homeBaseAddress: string): TripCandidate[] {
  const candidates: TripCandidate[] = [];
  for (const [tripDate, jobs] of groups) {
    const legs: TripLegDraft[] = jobs.map((job, index) => ({
      seq: index,
      from: index === 0 ? homeBaseAddress : jobs[index - 1].address,
      to: job.address,
      jobId: job.id,
      jobLabel: job.label,
    }));
    legs.push({ seq: jobs.length, from: jobs[jobs.length - 1].address, to: homeBaseAddress, jobId: null, jobLabel: null });
    candidates.push({ tripDate, jobs, legs });
  }
  return candidates.sort((a, b) => a.tripDate.localeCompare(b.tripDate));
}

export function buildTripPurpose(jobs: EligibleJob[]) {
  return jobs.map((job) => job.label).join(", ");
}

export function normalizeMileageSettings(
  settings: { home_base_address: string | null; irs_standard_mileage_rate: number | null } | null,
) {
  return {
    home_base_address: settings?.home_base_address?.trim() || null,
    irs_standard_mileage_rate: settings?.irs_standard_mileage_rate ?? null,
  };
}

export function buildMileageReportRows(approvedTrips: { trip_date: string; purpose: string; legs: MileageLeg[] }[]): ReportLegRow[] {
  const rows: ReportLegRow[] = [];
  for (const trip of approvedTrips) {
    for (const leg of trip.legs) {
      if (leg.miles === null) continue;
      rows.push({
        date: trip.trip_date,
        origin: leg.from,
        destination: leg.to,
        miles: leg.miles,
        purpose: leg.job_label ?? trip.purpose,
      });
    }
  }
  return rows;
}

export function summarizeMileageReport(rows: ReportLegRow[], ratePerMile: number | null) {
  const totalMiles = rows.reduce((sum, row) => sum + row.miles, 0);
  return {
    totalMiles,
    totalDeduction: ratePerMile === null ? null : Math.round(totalMiles * ratePerMile * 100) / 100,
  };
}
