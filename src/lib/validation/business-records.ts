import { z } from "zod";

const optionalText = (maximum = 5000) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().max(maximum).optional(),
);
const requiredText = (label: string, maximum = 5000) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.string().min(1, `${label} is required.`).max(maximum),
);
const date = (label: string, required = false) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`).refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, `${label} must be a valid date.`)[required ? "nonoptional" : "optional"](),
);
const number = (label: string, required = false) => z.preprocess(
  (value) => typeof value === "string" ? value.trim().replaceAll("$", "").replaceAll(",", "") || undefined : value,
  z.coerce.number().finite(`${label} must be a valid number.`).nonnegative(`${label} cannot be negative.`)[required ? "nonoptional" : "optional"](),
);
const positiveId = (label: string, required = true) => z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().positive(`Select ${label}.`)[required ? "nonoptional" : "optional"](),
);

export const quoteFormSchema = z.object({
  customerId: positiveId("a customer"),
  status: z.enum(["draft", "sent", "accepted", "declined", "no_response", "expired", "converted"]),
  quoteDate: date("Quote date", true), expirationDate: date("Expiration date"),
  sentDate: date("Sent date"), responseDate: date("Response date"),
  contactMethod: optionalText(50), referralSource: optionalText(250), serviceAddress: optionalText(500),
  municipality: optionalText(160), propertyLocation: optionalText(100), locationDescription: optionalText(),
  hazardNotes: optionalText(), customerScope: optionalText(), internalNotes: optionalText(),
  normalPrice: number("Normal price"), quotedPrice: number("Quoted price", true), discountReason: optionalText(500),
  proBono: z.boolean(), acceptedMethod: optionalText(50), acceptanceNotes: optionalText(), pa811Required: z.boolean(),
}).superRefine((value, context) => {
  if (value.status === "converted") context.addIssue({ code: "custom", path: ["status"], message: "Use Convert to Job to mark a quote converted." });
});

export const quoteStatusSchema = z.object({
  status: z.enum(["sent", "accepted", "declined", "no_response", "expired"]),
  acceptedMethod: optionalText(50),
});

export const invoiceFormSchema = z.object({
  customerId: positiveId("a customer"), jobId: positiveId("a job", false), amount: number("Amount", true),
  invoiceDate: date("Invoice date", true), dueDate: date("Due date"), paymentTerms: optionalText(250),
  status: z.enum(["draft", "unpaid", "paid", "void"]), paidDate: date("Paid date"), notes: optionalText(),
}).superRefine((value, context) => {
  if (value.status === "paid" && !value.paidDate) context.addIssue({ code: "custom", path: ["paidDate"], message: "Paid date is required for a paid invoice." });
});

export const expenseFormSchema = z.object({
  expenseDate: date("Expense date", true), category: requiredText("Category", 100), vendor: optionalText(250),
  description: optionalText(1000), amount: number("Amount", true), paymentMethod: optionalText(100),
  jobId: positiveId("a job", false), equipmentId: positiveId("equipment", false), notes: optionalText(),
});

export const equipmentFormSchema = z.object({
  name: requiredText("Equipment name", 250), equipmentType: optionalText(100), makeModel: optionalText(250),
  serialNumber: optionalText(250), hourMeter: number("Hour meter"), active: z.boolean(), notes: optionalText(),
});

export const maintenanceFormSchema = z.object({
  equipmentId: positiveId("equipment"), serviceDate: date("Service date", true), serviceType: requiredText("Service type", 250),
  hourMeter: number("Hour meter"), cost: number("Cost"), nextDueDate: date("Next due date"),
  nextDueHours: number("Next due hours"), notes: optionalText(),
});

export function formValues(formData: FormData, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, formData.get(name)]));
}
