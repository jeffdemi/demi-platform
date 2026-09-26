import { z } from "zod";

const cleanedOptionalText = (maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    z.string().max(maximum).optional(),
  );

const optionalDate = (label: string) =>
  z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`).refine(
      (value) => {
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      },
      `${label} must be a valid date.`,
    ).optional(),
  );

const optionalTime = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Scheduled start time must be a valid time.").optional(),
);

const optionalNumber = (label: string, integer = false) =>
  z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    (integer ? z.coerce.number().int(`${label} must be a whole number.`) : z.coerce.number())
      .nonnegative(`${label} cannot be negative.`)
      .finite(`${label} must be a valid number.`)
      .optional(),
  );

const optionalPositiveId = (label: string) =>
  z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().positive(`Select ${label}.`).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => typeof value === "string" ? value.trim().toLocaleLowerCase() || undefined : value,
  z.email("Enter a valid email address.").max(320).optional(),
);

export const customerFormSchema = z.object({
  customerType: z.enum(["individual", "company"]),
  companyName: cleanedOptionalText(160),
  firstName: cleanedOptionalText(100),
  lastName: cleanedOptionalText(100),
  phone: cleanedOptionalText(50),
  email: optionalEmail,
  streetAddress: cleanedOptionalText(250),
  city: cleanedOptionalText(100),
  state: cleanedOptionalText(50),
  zip: cleanedOptionalText(20),
  notes: cleanedOptionalText(5000),
  active: z.boolean(),
}).superRefine((value, context) => {
  if (value.customerType === "company" && !value.companyName) {
    context.addIssue({ code: "custom", path: ["companyName"], message: "Company name is required." });
  }
  if (value.customerType === "individual" && !value.firstName && !value.lastName) {
    context.addIssue({ code: "custom", path: ["firstName"], message: "Enter a first or last name." });
  }
});

export const jobFormSchema = z.object({
  customerId: z.coerce.number().int().positive("Select a customer."),
  quoteId: optionalPositiveId("a quote"),
  status: z.string().trim().min(1, "Select a status."),
  jobDate: optionalDate("Job date"),
  scheduledDate: optionalDate("Scheduled date"),
  scheduledStartTime: optionalTime,
  estimatedDurationMinutes: optionalNumber("Estimated duration", true),
  completedDate: optionalDate("Completed date"),
  serviceAddress: cleanedOptionalText(500),
  propertyLocation: cleanedOptionalText(250),
  locationDescription: cleanedOptionalText(2000),
  referralSource: cleanedOptionalText(250),
  workDescription: cleanedOptionalText(5000),
  hazardNotes: cleanedOptionalText(5000),
  amountQuoted: optionalNumber("Quoted amount"),
  amountPaid: optionalNumber("Amount paid"),
  paymentMethod: cleanedOptionalText(100),
  paidDate: optionalDate("Paid date"),
  travelMinutes: optionalNumber("Travel minutes", true),
  grindingMinutes: optionalNumber("Grinding minutes", true),
  cleanupMinutes: optionalNumber("Cleanup minutes", true),
  machineHours: optionalNumber("Machine hours"),
  proBono: z.boolean(),
  pa811Required: z.boolean(),
  notes: cleanedOptionalText(5000),
});

export function valuesFromFormData(formData: FormData) {
  return {
    customerType: formData.get("customerType"),
    companyName: formData.get("companyName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    streetAddress: formData.get("streetAddress"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    notes: formData.get("notes"),
    active: formData.get("active") === "on",
  };
}

export function jobValuesFromFormData(formData: FormData) {
  return {
    customerId: formData.get("customerId"),
    quoteId: formData.get("quoteId"),
    status: formData.get("status"),
    jobDate: formData.get("jobDate"),
    scheduledDate: formData.get("scheduledDate"),
    scheduledStartTime: formData.get("scheduledStartTime"),
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes"),
    completedDate: formData.get("completedDate"),
    serviceAddress: formData.get("serviceAddress"),
    propertyLocation: formData.get("propertyLocation"),
    locationDescription: formData.get("locationDescription"),
    referralSource: formData.get("referralSource"),
    workDescription: formData.get("workDescription"),
    hazardNotes: formData.get("hazardNotes"),
    amountQuoted: formData.get("amountQuoted"),
    amountPaid: formData.get("amountPaid"),
    paymentMethod: formData.get("paymentMethod"),
    paidDate: formData.get("paidDate"),
    travelMinutes: formData.get("travelMinutes"),
    grindingMinutes: formData.get("grindingMinutes"),
    cleanupMinutes: formData.get("cleanupMinutes"),
    machineHours: formData.get("machineHours"),
    proBono: formData.get("proBono") === "on",
    pa811Required: formData.get("pa811Required") === "on",
    notes: formData.get("notes"),
  };
}
