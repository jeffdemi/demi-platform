"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { saveFinancialSettings, saveOwnerCompensation } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { financialSettingsSchema, formValues, ownerCompensationSchema } from "@/lib/validation/business-records";

export type ReportingSettingsState = { message?: string; success?: boolean; errors?: Record<string, string[]> };

function refreshReporting() {
  revalidatePath("/reports/settings");
  revalidatePath("/reports");
  revalidatePath("/finance/month-end");
  revalidatePath("/labor");
}

export async function updateFinancialSettings(_: ReportingSettingsState, formData: FormData): Promise<ReportingSettingsState> {
  const parsed = financialSettingsSchema.safeParse({
    ...formValues(formData, [
      "ownerMarketSalaryAnnual", "ownerLaborClass", "reportingBasis", "targetTotalLer",
      "minimumProfitPercent", "targetProfitPercent", "stretchProfitPercent", "coreCapitalMonths", "minimumRoicPercent",
    ]),
    hasNonOwnerLabor: formData.get("hasNonOwnerLabor") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const requiredTargets = [
    parsed.data.minimumProfitPercent,
    parsed.data.targetProfitPercent,
    parsed.data.stretchProfitPercent,
    parsed.data.minimumRoicPercent,
  ];
  if (requiredTargets.some((value) => value === undefined)) return { message: "All reporting targets are required." };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can change financial settings." };
  try {
    await saveFinancialSettings(await createClient(), {
      business_id: context.business.id,
      owner_market_salary_annual: parsed.data.ownerMarketSalaryAnnual ?? null,
      owner_labor_class: parsed.data.ownerLaborClass,
      has_non_owner_labor: parsed.data.hasNonOwnerLabor,
      reporting_basis: parsed.data.reportingBasis,
      target_total_ler: parsed.data.targetTotalLer,
      minimum_profit_to_gross_margin: parsed.data.minimumProfitPercent! / 100,
      target_profit_to_gross_margin: parsed.data.targetProfitPercent! / 100,
      stretch_profit_to_gross_margin: parsed.data.stretchProfitPercent! / 100,
      core_capital_months: parsed.data.coreCapitalMonths,
      minimum_roic: parsed.data.minimumRoicPercent! / 100,
    });
    refreshReporting();
    return { success: true, message: "Owner compensation and reporting targets saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The settings could not be saved." };
  }
}

export async function updateOwnerCompensation(_: ReportingSettingsState, formData: FormData): Promise<ReportingSettingsState> {
  const month = String(formData.get("periodMonth") ?? "");
  const parsed = ownerCompensationSchema.safeParse({
    ...formValues(formData, ["marketSalaryAmount", "actualWages", "distributions", "contributions", "notes"]),
    periodMonth: /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.periodMonth) return { message: "Select an owner compensation month." };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can record owner compensation." };
  try {
    await saveOwnerCompensation(await createClient(), {
      business_id: context.business.id,
      period_month: parsed.data.periodMonth,
      market_salary_amount: parsed.data.marketSalaryAmount,
      actual_wages: parsed.data.actualWages,
      distributions: parsed.data.distributions,
      contributions: parsed.data.contributions,
      notes: parsed.data.notes ?? null,
      created_by: context.user.id,
    });
    refreshReporting();
    return { success: true, message: "Owner compensation month saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Owner compensation could not be saved." };
  }
}
