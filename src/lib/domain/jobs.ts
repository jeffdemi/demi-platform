import type { Database } from "@/types/database";
import { customerDisplayName, type Customer } from "./customers";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];

export const jobStatusOptions = [
  { value: "lead", label: "Lead" },
  { value: "quoted", label: "Quoted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const operationalViews = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "unscheduled", label: "Unscheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type SupportedJobStatus = (typeof jobStatusOptions)[number]["value"];
export type OperationalView = (typeof operationalViews)[number]["value"];
export type JobWithCustomer = Job & {
  customers: Pick<Customer, "company_name" | "customer_type" | "email" | "first_name" | "last_name" | "phone">;
};

const supportedStatuses = new Set<string>(jobStatusOptions.map(({ value }) => value));

export function isSupportedJobStatus(value: string): value is SupportedJobStatus {
  return supportedStatuses.has(value);
}

export function jobStatusLabel(status: string | null | undefined) {
  if (!status) return "Not set";
  const known = jobStatusOptions.find(({ value }) => value === status);
  if (known) return known.label;

  const words = status.split("_").filter(Boolean).join(" ").toLocaleLowerCase();
  return words ? words.charAt(0).toLocaleUpperCase() + words.slice(1) : "Unknown";
}

export function jobMatchesSearch(job: JobWithCustomer, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    customerDisplayName(job.customers),
    job.customers.first_name,
    job.customers.last_name,
    job.customers.company_name,
    job.customers.phone,
    job.service_address,
    job.municipality,
    job.work_description,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function jobMatchesOperationalView(
  job: Pick<Job, "job_date" | "scheduled_date" | "status">,
  view: string,
  today: string,
) {
  if (view === "today") {
    return job.scheduled_date === today || job.job_date === today;
  }
  if (view === "upcoming") {
    return Boolean(
      job.scheduled_date &&
      job.scheduled_date > today &&
      !["paid", "cancelled"].includes(job.status),
    );
  }
  if (view === "unscheduled") {
    return !job.scheduled_date && !["completed", "invoiced", "paid", "cancelled"].includes(job.status);
  }
  if (view === "completed") {
    return ["completed", "invoiced", "paid"].includes(job.status);
  }
  if (view === "cancelled") {
    return job.status === "cancelled";
  }
  return true;
}

export function dateInTimeZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}
