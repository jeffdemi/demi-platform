import "server-only";

import { createHash } from "node:crypto";
import {
  defaultExpenseAiModel,
  expenseAiResponseJsonSchema,
  expenseAssistantContext,
  expenseAssistantInstructions,
  matchOptionByLabel,
  parseExpenseAiResponse,
  type ExpenseAiOption,
} from "@/lib/domain/expense-ai";
import { extractOpenAiResponseText } from "@/lib/services/quote-ai";

function expenseAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    model: process.env.OPENAI_EXPENSE_MODEL?.trim() || defaultExpenseAiModel,
  };
}

export function isExpenseAiConfigured() {
  return Boolean(expenseAiConfig().apiKey);
}

type ExpenseAiConfidenceLevel = "high" | "medium" | "low";

export type ExpenseAiFieldSuggestion = {
  category: string;
  vendor: string | null;
  taxCategory: string | null;
  deductiblePercent: number;
  financialClassification: string;
  laborClass: string | null;
  paymentMethod: string | null;
  jobId: number | null;
  equipmentId: number | null;
  assistantNote: string;
  confidence: {
    category: ExpenseAiConfidenceLevel;
    vendor: ExpenseAiConfidenceLevel;
    taxCategory: ExpenseAiConfidenceLevel;
    deductiblePercent: ExpenseAiConfidenceLevel;
    financialClassification: ExpenseAiConfidenceLevel;
    laborClass: ExpenseAiConfidenceLevel;
    paymentMethod: ExpenseAiConfidenceLevel;
    jobId: ExpenseAiConfidenceLevel;
    equipmentId: ExpenseAiConfidenceLevel;
  };
};

export async function suggestExpenseFields(
  businessId: number,
  userId: string,
  input: {
    description: string;
    bankDescription?: string | null;
    bankAmount?: number | null;
    bankDate?: string | null;
    categories: string[];
    jobs: ExpenseAiOption[];
    equipment: ExpenseAiOption[];
  },
): Promise<ExpenseAiFieldSuggestion> {
  const { apiKey, model } = expenseAiConfig();
  if (!apiKey) throw new Error("AI expense classification is not configured yet. Add OPENAI_API_KEY.");
  const description = input.description.trim();
  if (!description) throw new Error("Enter a description first.");
  if (description.length > 1000) throw new Error("Keep the description under 1,000 characters.");

  const safetyIdentifier = createHash("sha256").update(`${businessId}:${userId}`).digest("hex");
  const body = {
    model,
    instructions: expenseAssistantInstructions(),
    input: [{ role: "user" as const, content: expenseAssistantContext({ ...input, description }) }],
    reasoning: { effort: "low" },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "expense_suggestion",
        strict: true,
        schema: expenseAiResponseJsonSchema,
      },
    },
    max_output_tokens: 1200,
    store: false,
    safety_identifier: safetyIdentifier,
  };

  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const response = await result.json().catch(() => null) as { output_text?: string; output?: unknown; error?: { message?: string } } | null;
  if (!result.ok) {
    console.error("Expense AI request failed", { status: result.status, message: response?.error?.message });
    throw new Error("The AI classifier is temporarily unavailable. Fill the fields in manually for now.");
  }
  const text = extractOpenAiResponseText(response);
  if (!text) throw new Error("The AI classifier returned an empty response. Try again.");
  const suggestion = parseExpenseAiResponse(text);

  const jobMatch = matchOptionByLabel(suggestion.jobLabelGuess, input.jobs);
  const equipmentMatch = matchOptionByLabel(suggestion.equipmentLabelGuess, input.equipment);

  return {
    category: suggestion.category,
    vendor: suggestion.vendor,
    taxCategory: suggestion.taxCategory,
    deductiblePercent: suggestion.deductiblePercent,
    financialClassification: suggestion.financialClassification,
    laborClass: suggestion.laborClass,
    paymentMethod: suggestion.paymentMethod,
    jobId: jobMatch?.id ?? null,
    equipmentId: equipmentMatch?.id ?? null,
    assistantNote: suggestion.assistantNote,
    confidence: {
      category: suggestion.confidence.category,
      vendor: suggestion.confidence.vendor,
      taxCategory: suggestion.confidence.taxCategory,
      deductiblePercent: suggestion.confidence.deductiblePercent,
      financialClassification: suggestion.confidence.financialClassification,
      laborClass: suggestion.confidence.laborClass,
      paymentMethod: suggestion.confidence.paymentMethod,
      // A label that didn't match any real job/equipment record can't be "high" confidence, whatever the model said.
      jobId: suggestion.jobLabelGuess && !jobMatch ? "low" : suggestion.confidence.job,
      equipmentId: suggestion.equipmentLabelGuess && !equipmentMatch ? "low" : suggestion.confidence.equipment,
    },
  };
}
