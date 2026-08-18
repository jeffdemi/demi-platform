"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { archiveLaborEntry, createLaborEntry } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { formValues, laborEntrySchema, voidLaborEntrySchema } from "@/lib/validation/business-records";

export type LaborState = { message?: string; success?: boolean; errors?: Record<string, string[]> };

function refreshLaborPages() {
  revalidatePath("/labor");
  revalidatePath("/reports");
  revalidatePath("/finance/month-end");
}

export async function saveLaborEntry(_: LaborState, formData: FormData): Promise<LaborState> {
  const parsed = laborEntrySchema.safeParse(formValues(formData, [
    "workerName", "workerType", "laborClass", "periodStart", "periodEnd", "paidDate",
    "regularHours", "overtimeHours", "grossWages", "employerPayrollTaxes", "benefits", "jobId", "notes",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.periodStart || !parsed.data.periodEnd) return { message: "The payroll period is required." };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can record payroll." };
  try {
    await createLaborEntry(await createClient(), {
      business_id: context.business.id,
      worker_name: parsed.data.workerName,
      worker_type: parsed.data.workerType,
      labor_class: parsed.data.laborClass,
      period_start: parsed.data.periodStart,
      period_end: parsed.data.periodEnd,
      paid_date: parsed.data.paidDate ?? null,
      regular_hours: parsed.data.regularHours,
      overtime_hours: parsed.data.overtimeHours,
      gross_wages: parsed.data.grossWages,
      employer_payroll_taxes: parsed.data.employerPayrollTaxes,
      benefits: parsed.data.benefits,
      job_id: parsed.data.jobId ?? null,
      notes: parsed.data.notes ?? null,
      created_by: context.user.id,
    });
    refreshLaborPages();
    return { success: true, message: "Labor entry saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The labor entry could not be saved." };
  }
}

export async function voidLaborEntry(entryId: number, _: LaborState, formData: FormData): Promise<LaborState> {
  const parsed = voidLaborEntrySchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can archive payroll." };
  const archived = await archiveLaborEntry(
    await createClient(), context.business.id, entryId, context.user.id, parsed.data.reason,
  );
  if (!archived) return { message: "That labor entry is no longer available." };
  refreshLaborPages();
  return { success: true, message: "Labor entry archived." };
}
