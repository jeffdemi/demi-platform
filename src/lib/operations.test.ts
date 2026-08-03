import { describe, expect, it } from "vitest";
import { customerDisplayName, customerMatchesSearch, type Customer } from "./domain/customers";
import {
  dateInTimeZone,
  jobMatchesOperationalView,
  jobMatchesSearch,
  jobStatusLabel,
  type JobWithCustomer,
} from "./domain/jobs";
import { customerFormSchema, jobFormSchema } from "./validation/operations";

const customer = {
  id: 1,
  business_id: 1,
  legacy_id: null,
  customer_type: "individual",
  company_name: "Demi Tree Care",
  first_name: "Jeff",
  last_name: "Demi",
  phone: "610-555-0100",
  email: "jeff@example.com",
  notes: null,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} satisfies Customer;

const job = {
  id: 10,
  business_id: 1,
  customer_id: 1,
  quote_id: null,
  legacy_id: null,
  source_job_number: null,
  status: "scheduled",
  job_date: "2026-08-01",
  scheduled_date: "2026-08-02",
  scheduled_start_time: "09:30:00",
  estimated_duration_minutes: 90,
  completed_date: null,
  service_address: "10 Pine Lane",
  municipality: "West Chester",
  property_location: "Rear yard",
  location_description: null,
  referral_source: null,
  work_description: "Grind two maple stumps",
  hazard_notes: null,
  amount_quoted: 350,
  amount_paid: null,
  payment_method: null,
  paid_date: null,
  travel_minutes: null,
  grinding_minutes: null,
  cleanup_minutes: null,
  machine_hours: null,
  pro_bono: false,
  pa811_required: false,
  notes: null,
  import_fingerprint: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  customers: {
    company_name: customer.company_name,
    customer_type: customer.customer_type,
    first_name: customer.first_name,
    last_name: customer.last_name,
    phone: customer.phone,
    email: customer.email,
  },
} satisfies JobWithCustomer;

describe("customer operations", () => {
  it("uses the correct display name for each customer type", () => {
    expect(customerDisplayName(customer)).toBe("Jeff Demi");
    expect(customerDisplayName({ customer_type: "company", company_name: "Demi Tree Care", first_name: "Jeff", last_name: "Demi" })).toBe("Demi Tree Care");
  });

  it.each(["Jeff", "Demi", "Tree Care", "610-555", "jeff@example.com"])(
    "searches customer field %s",
    (search) => expect(customerMatchesSearch(customer, search)).toBe(true),
  );

  it("requires the correct name for each customer type", () => {
    const base = { companyName: undefined, firstName: undefined, lastName: undefined, phone: undefined, email: undefined, notes: undefined, active: true };
    expect(customerFormSchema.safeParse({ ...base, customerType: "company" }).success).toBe(false);
    expect(customerFormSchema.safeParse({ ...base, customerType: "individual" }).success).toBe(false);
    expect(customerFormSchema.safeParse({ ...base, customerType: "company", companyName: "Acme" }).success).toBe(true);
    expect(customerFormSchema.safeParse({ ...base, customerType: "individual", lastName: "Demi" }).success).toBe(true);
  });
});

describe("job operations", () => {
  it.each(["Jeff", "Demi", "Tree Care", "610-555", "Pine Lane", "West Chester", "maple stumps"])(
    "searches job field %s",
    (search) => expect(jobMatchesSearch(job, search)).toBe(true),
  );

  it("keeps historical statuses readable without treating them as editable options", () => {
    expect(jobStatusLabel("no_response")).toBe("No response");
    expect(jobStatusLabel("imported_custom_value")).toBe("Imported custom value");
  });

  it("matches each operational view", () => {
    expect(jobMatchesOperationalView(job, "today", "2026-08-02")).toBe(true);
    expect(jobMatchesOperationalView(job, "upcoming", "2026-08-01")).toBe(true);
    expect(jobMatchesOperationalView({ ...job, scheduled_date: null, status: "lead" }, "unscheduled", "2026-08-02")).toBe(true);
    expect(jobMatchesOperationalView({ ...job, status: "paid" }, "completed", "2026-08-02")).toBe(true);
    expect(jobMatchesOperationalView({ ...job, status: "cancelled" }, "cancelled", "2026-08-02")).toBe(true);
  });

  it("uses the business timezone when calculating today", () => {
    expect(dateInTimeZone("America/New_York", new Date("2026-08-02T02:00:00Z"))).toBe("2026-08-01");
  });

  it("rejects malformed operational values", () => {
    const result = jobFormSchema.safeParse({
      customerId: "1",
      status: "scheduled",
      jobDate: "2026-02-31",
      scheduledDate: "not-a-date",
      scheduledStartTime: "25:90",
      estimatedDurationMinutes: "1.5",
      completedDate: "",
      serviceAddress: "",
      municipality: "",
      propertyLocation: "",
      locationDescription: "",
      referralSource: "",
      workDescription: "",
      hazardNotes: "",
      amountQuoted: "abc",
      amountPaid: "",
      paymentMethod: "",
      paidDate: "",
      travelMinutes: "",
      grindingMinutes: "",
      cleanupMinutes: "",
      machineHours: "",
      proBono: false,
      pa811Required: false,
      notes: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.jobDate).toBeDefined();
      expect(errors.scheduledDate).toBeDefined();
      expect(errors.scheduledStartTime).toBeDefined();
      expect(errors.estimatedDurationMinutes).toBeDefined();
      expect(errors.amountQuoted).toBeDefined();
    }
  });
});
