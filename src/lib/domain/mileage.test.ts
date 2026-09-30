import { describe, expect, it } from "vitest";
import {
  buildEligibleJobs,
  buildMileageReportRows,
  buildTripCandidates,
  buildTripPurpose,
  effectiveJobDate,
  excludeAlreadySuggested,
  groupJobsByTripDate,
  normalizeAddressQuery,
  normalizeMileageSettings,
  resolveJobAddress,
  summarizeMileageReport,
  type EligibleJob,
} from "./mileage";

const customer = { street_address: "9 Oak Ln", city: "Springfield", state: "PA", zip: "19064", company_name: null, customer_type: "individual" as const, first_name: "Jane", last_name: "Doe" };

describe("effectiveJobDate", () => {
  it("prefers completed_date over scheduled_date", () => {
    expect(effectiveJobDate({ completed_date: "2026-03-02", scheduled_date: "2026-03-01" })).toBe("2026-03-02");
  });
  it("falls back to scheduled_date when not completed", () => {
    expect(effectiveJobDate({ completed_date: null, scheduled_date: "2026-03-01" })).toBe("2026-03-01");
  });
  it("returns null when neither is set", () => {
    expect(effectiveJobDate({ completed_date: null, scheduled_date: null })).toBeNull();
  });
});

describe("resolveJobAddress", () => {
  it("prefers the job's own service address", () => {
    expect(resolveJobAddress({ service_address: "1 Elm St" }, customer)).toBe("1 Elm St");
  });
  it("falls back to the customer's address when the job has none", () => {
    expect(resolveJobAddress({ service_address: null }, customer)).toBe("9 Oak Ln, Springfield, PA 19064");
  });
  it("returns null when neither the job nor the customer has an address", () => {
    expect(resolveJobAddress({ service_address: null }, { ...customer, street_address: null, city: null, state: null, zip: null })).toBeNull();
    expect(resolveJobAddress({ service_address: null }, null)).toBeNull();
  });
});

describe("normalizeAddressQuery", () => {
  it("collapses case, punctuation, and whitespace so equivalent addresses share a cache key", () => {
    expect(normalizeAddressQuery("123 Main St., Apt #2")).toBe(normalizeAddressQuery("123 MAIN ST APT 2"));
  });
});

describe("buildEligibleJobs", () => {
  const customersById = new Map([[1, customer]]);
  const baseJob = { id: 10, customer_id: 1, status: "completed", service_address: "5 Pine Rd", scheduled_date: "2026-04-01", completed_date: "2026-04-02", scheduled_start_time: null };

  it("includes completed/invoiced/paid jobs with a resolvable address and date", () => {
    const eligible = buildEligibleJobs([baseJob], customersById);
    expect(eligible).toEqual([{ id: 10, date: "2026-04-02", address: "5 Pine Rd", scheduledStartTime: null, label: "Job #10 (Jane Doe)" }]);
  });

  it("excludes jobs whose status hasn't reached completed/invoiced/paid", () => {
    expect(buildEligibleJobs([{ ...baseJob, status: "scheduled" }], customersById)).toEqual([]);
    expect(buildEligibleJobs([{ ...baseJob, status: "lead" }], customersById)).toEqual([]);
    expect(buildEligibleJobs([{ ...baseJob, status: "in_progress" }], customersById)).toEqual([]);
    expect(buildEligibleJobs([{ ...baseJob, status: "cancelled" }], customersById)).toEqual([]);
  });

  it("includes invoiced and paid jobs", () => {
    expect(buildEligibleJobs([{ ...baseJob, status: "invoiced" }], customersById)).toHaveLength(1);
    expect(buildEligibleJobs([{ ...baseJob, status: "paid" }], customersById)).toHaveLength(1);
  });

  it("excludes a job with no date or no resolvable address", () => {
    expect(buildEligibleJobs([{ ...baseJob, scheduled_date: null, completed_date: null }], customersById)).toEqual([]);
    expect(buildEligibleJobs([{ ...baseJob, service_address: null, customer_id: 99 }], customersById)).toEqual([]);
  });
});

describe("excludeAlreadySuggested", () => {
  it("filters out jobs already linked to a trip", () => {
    const jobs: EligibleJob[] = [{ id: 1, date: "2026-01-01", address: "a", scheduledStartTime: null, label: "Job #1" }, { id: 2, date: "2026-01-01", address: "b", scheduledStartTime: null, label: "Job #2" }];
    expect(excludeAlreadySuggested(jobs, new Set([1]))).toEqual([jobs[1]]);
  });
});

describe("groupJobsByTripDate", () => {
  it("orders same-day jobs by scheduled_start_time, then by id when times are missing", () => {
    const jobs: EligibleJob[] = [
      { id: 2, date: "2026-05-01", address: "b", scheduledStartTime: "13:00", label: "Job #2" },
      { id: 1, date: "2026-05-01", address: "a", scheduledStartTime: "09:00", label: "Job #1" },
      { id: 3, date: "2026-05-01", address: "c", scheduledStartTime: null, label: "Job #3" },
      { id: 4, date: "2026-05-02", address: "d", scheduledStartTime: null, label: "Job #4" },
    ];
    const groups = groupJobsByTripDate(jobs);
    expect(groups.get("2026-05-01")!.map((job) => job.id)).toEqual([1, 2, 3]);
    expect(groups.get("2026-05-02")!.map((job) => job.id)).toEqual([4]);
  });
});

describe("buildTripCandidates", () => {
  it("builds a simple round trip for a single job", () => {
    const groups = groupJobsByTripDate([{ id: 1, date: "2026-05-01", address: "Job A", scheduledStartTime: null, label: "Job #1" }]);
    const [candidate] = buildTripCandidates(groups, "Home Base");
    expect(candidate.legs).toEqual([
      { seq: 0, from: "Home Base", to: "Job A", jobId: 1, jobLabel: "Job #1" },
      { seq: 1, from: "Job A", to: "Home Base", jobId: null, jobLabel: null },
    ]);
  });

  it("chains multiple same-day jobs into one route with a per-leg breakdown", () => {
    const groups = groupJobsByTripDate([
      { id: 1, date: "2026-05-01", address: "Job A", scheduledStartTime: "09:00", label: "Job #1" },
      { id: 2, date: "2026-05-01", address: "Job B", scheduledStartTime: "13:00", label: "Job #2" },
    ]);
    const [candidate] = buildTripCandidates(groups, "Home Base");
    expect(candidate.legs).toEqual([
      { seq: 0, from: "Home Base", to: "Job A", jobId: 1, jobLabel: "Job #1" },
      { seq: 1, from: "Job A", to: "Job B", jobId: 2, jobLabel: "Job #2" },
      { seq: 2, from: "Job B", to: "Home Base", jobId: null, jobLabel: null },
    ]);
  });

  it("orders candidates oldest date first", () => {
    const groups = groupJobsByTripDate([
      { id: 1, date: "2026-05-02", address: "Job A", scheduledStartTime: null, label: "Job #1" },
      { id: 2, date: "2026-05-01", address: "Job B", scheduledStartTime: null, label: "Job #2" },
    ]);
    const candidates = buildTripCandidates(groups, "Home Base");
    expect(candidates.map((candidate) => candidate.tripDate)).toEqual(["2026-05-01", "2026-05-02"]);
  });
});

describe("buildTripPurpose", () => {
  it("joins every job's label for a chained trip", () => {
    const jobs: EligibleJob[] = [{ id: 1, date: "2026-05-01", address: "a", scheduledStartTime: null, label: "Job #1 (Jane Doe)" }, { id: 2, date: "2026-05-01", address: "b", scheduledStartTime: null, label: "Job #2 (Acme Co)" }];
    expect(buildTripPurpose(jobs)).toBe("Job #1 (Jane Doe), Job #2 (Acme Co)");
  });
});

describe("normalizeMileageSettings", () => {
  it("returns null fields when settings are absent, never a guessed default rate", () => {
    expect(normalizeMileageSettings(null)).toEqual({ home_base_address: null, irs_standard_mileage_rate: null });
  });
  it("trims the home base address and passes the rate through", () => {
    expect(normalizeMileageSettings({ home_base_address: "  9 Oak Ln  ", irs_standard_mileage_rate: 0.67 })).toEqual({ home_base_address: "9 Oak Ln", irs_standard_mileage_rate: 0.67 });
  });
});

describe("buildMileageReportRows", () => {
  it("flattens legs across trips and labels each leg by its own job when present", () => {
    const rows = buildMileageReportRows([
      {
        trip_date: "2026-05-01",
        purpose: "Job #1 (Jane Doe), Job #2 (Acme Co)",
        legs: [
          { seq: 0, from: "Home", to: "Job A", miles: 10, job_id: 1, job_label: "Job #1 (Jane Doe)" },
          { seq: 1, from: "Job A", to: "Job B", miles: 5, job_id: 2, job_label: "Job #2 (Acme Co)" },
          { seq: 2, from: "Job B", to: "Home", miles: 12, job_id: null, job_label: null },
        ],
      },
    ]);
    expect(rows).toEqual([
      { date: "2026-05-01", origin: "Home", destination: "Job A", miles: 10, purpose: "Job #1 (Jane Doe)" },
      { date: "2026-05-01", origin: "Job A", destination: "Job B", miles: 5, purpose: "Job #2 (Acme Co)" },
      { date: "2026-05-01", origin: "Job B", destination: "Home", miles: 12, purpose: "Job #1 (Jane Doe), Job #2 (Acme Co)" },
    ]);
  });

  it("skips a leg that never got a resolved distance", () => {
    const rows = buildMileageReportRows([
      { trip_date: "2026-05-01", purpose: "Manual trip", legs: [{ seq: 0, from: "Home", to: "Store", miles: null, job_id: null, job_label: null }] },
    ]);
    expect(rows).toEqual([]);
  });
});

describe("summarizeMileageReport", () => {
  it("returns a null deduction when no rate is configured, never a guessed number", () => {
    const rows = [{ date: "2026-05-01", origin: "a", destination: "b", miles: 10, purpose: "x" }];
    expect(summarizeMileageReport(rows, null)).toEqual({ totalMiles: 10, totalDeduction: null });
  });
  it("multiplies total miles by the configured rate", () => {
    const rows = [
      { date: "2026-05-01", origin: "a", destination: "b", miles: 10, purpose: "x" },
      { date: "2026-05-02", origin: "c", destination: "d", miles: 5.5, purpose: "y" },
    ];
    expect(summarizeMileageReport(rows, 0.67)).toEqual({ totalMiles: 15.5, totalDeduction: 10.39 });
  });
});
