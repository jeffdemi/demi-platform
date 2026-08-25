import { z } from "zod";
import { expensePaymentMethodOptions } from "./finance";
import { financialClassificationOptions, laborClassOptions } from "./management-accounting";

export const expenseAiPromptVersion = "expense-classifier-v1";
export const defaultExpenseAiModel = "gpt-5.6-terra";

const financialClassificationValues = financialClassificationOptions.map((option) => option.value) as [string, ...string[]];
const laborClassValues = laborClassOptions.map((option) => option.value) as [string, ...string[]];
const paymentMethodValues = expensePaymentMethodOptions.map((option) => option.value) as [string, ...string[]];
const confidenceValues = ["high", "medium", "low"] as const;

const confidenceSchema = z.enum(confidenceValues);

export const expenseAiSuggestionSchema = z.object({
  assistantNote: z.string(),
  category: z.string().min(1),
  vendor: z.string().nullable(),
  taxCategory: z.string().nullable(),
  deductiblePercent: z.number().min(0).max(100),
  financialClassification: z.enum(financialClassificationValues),
  laborClass: z.enum(laborClassValues).nullable(),
  paymentMethod: z.enum(paymentMethodValues).nullable(),
  jobLabelGuess: z.string().nullable(),
  equipmentLabelGuess: z.string().nullable(),
  confidence: z.object({
    category: confidenceSchema,
    vendor: confidenceSchema,
    taxCategory: confidenceSchema,
    deductiblePercent: confidenceSchema,
    financialClassification: confidenceSchema,
    laborClass: confidenceSchema,
    paymentMethod: confidenceSchema,
    job: confidenceSchema,
    equipment: confidenceSchema,
  }),
});

export type ExpenseAiSuggestion = z.infer<typeof expenseAiSuggestionSchema>;
export type ExpenseAiConfidence = z.infer<typeof confidenceSchema>;

export const expenseAiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assistantNote", "category", "vendor", "taxCategory", "deductiblePercent",
    "financialClassification", "laborClass", "paymentMethod", "jobLabelGuess",
    "equipmentLabelGuess", "confidence",
  ],
  properties: {
    assistantNote: { type: "string" },
    category: { type: "string" },
    vendor: { type: ["string", "null"] },
    taxCategory: { type: ["string", "null"] },
    deductiblePercent: { type: "number", minimum: 0, maximum: 100 },
    financialClassification: { type: "string", enum: financialClassificationValues },
    laborClass: { type: ["string", "null"], enum: [...laborClassValues, null] },
    paymentMethod: { type: ["string", "null"], enum: [...paymentMethodValues, null] },
    jobLabelGuess: { type: ["string", "null"] },
    equipmentLabelGuess: { type: ["string", "null"] },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["category", "vendor", "taxCategory", "deductiblePercent", "financialClassification", "laborClass", "paymentMethod", "job", "equipment"],
      properties: {
        category: { type: "string", enum: confidenceValues },
        vendor: { type: "string", enum: confidenceValues },
        taxCategory: { type: "string", enum: confidenceValues },
        deductiblePercent: { type: "string", enum: confidenceValues },
        financialClassification: { type: "string", enum: confidenceValues },
        laborClass: { type: "string", enum: confidenceValues },
        paymentMethod: { type: "string", enum: confidenceValues },
        job: { type: "string", enum: confidenceValues },
        equipment: { type: "string", enum: confidenceValues },
      },
    },
  },
} as const;

export function parseExpenseAiResponse(value: string) {
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    throw new Error("The AI response was not valid structured data.");
  }
  return expenseAiSuggestionSchema.parse(json);
}

export function expenseAssistantInstructions() {
  return `You are a bookkeeping copilot for Jeff at Demi Stump Grinding. Jeff will type a short plain-English description of one expense. Your job is to fill in every other field of the expense record so Jeff only has to review, not retype.

Only use these exact values where an enum is required:
- financialClassification: ${financialClassificationValues.join(", ")}
- laborClass (only when financialClassification is "labor", otherwise null): ${laborClassValues.join(", ")}
- paymentMethod (null if the description gives no clue how it was paid): ${paymentMethodValues.join(", ")}

Category and tax category are free text — prefer one of the business's existing categories when the description clearly matches one, otherwise propose a short, sensible category. Vendor is the payee's name if identifiable, otherwise null. deductiblePercent defaults to 100 unless the description signals a mixed personal/business use or an owner distribution (then 0).

jobLabelGuess and equipmentLabelGuess: if the description references a specific job or piece of equipment from the lists provided in context, return that job's or equipment's label text as closely as possible so it can be matched back to its record. If nothing in the description points to a specific job or equipment, return null — do not guess.

Rate your own confidence per field as "high", "medium", or "low". Default to "low" whenever the description is vague, generic, or could plausibly fit more than one category/classification — a wrong "high" is worse than an honest "low". Never invent a dollar amount; you are not asked for one. Keep assistantNote to one short sentence explaining your main assumption, or noting what's uncertain.`;
}

export type ExpenseAiOption = { id: number; label: string };

export function expenseAssistantContext(input: {
  description: string;
  bankDescription?: string | null;
  bankAmount?: number | null;
  bankDate?: string | null;
  categories: string[];
  jobs: ExpenseAiOption[];
  equipment: ExpenseAiOption[];
}) {
  return JSON.stringify({
    task: "Classify this expense from Jeff's description and fill in every other field.",
    jeffsDescription: input.description,
    bankFeedContext: input.bankDescription || input.bankAmount != null || input.bankDate ? {
      rawDescription: input.bankDescription ?? null,
      amount: input.bankAmount ?? null,
      date: input.bankDate ?? null,
    } : null,
    existingCategories: input.categories,
    knownJobs: input.jobs.map((job) => job.label),
    knownEquipment: input.equipment.map((item) => item.label),
  });
}

function normalizedWords(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2) ?? []);
}

// Fuzzy-matches the model's free-text guess back to a real job/equipment id by word overlap.
// Returns null (and the caller should treat confidence as low) when nothing matches well enough to trust.
export function matchOptionByLabel(guess: string | null, options: ExpenseAiOption[]): ExpenseAiOption | null {
  if (!guess) return null;
  const guessWords = normalizedWords(guess);
  if (!guessWords.size) return null;
  let best: { option: ExpenseAiOption; score: number } | null = null;
  for (const option of options) {
    const optionWords = normalizedWords(option.label);
    let score = 0;
    guessWords.forEach((word) => { if (optionWords.has(word)) score += 1; });
    if (score > 0 && (!best || score > best.score)) best = { option, score };
  }
  return best ? best.option : null;
}
