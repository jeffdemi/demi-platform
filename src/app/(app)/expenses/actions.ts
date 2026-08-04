"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { createExpense } from "@/lib/repositories/expense-repository";
import { createClient } from "@/lib/supabase/server";
import { expenseFormSchema, formValues } from "@/lib/validation/business-records";
export type ExpenseState = { message?: string; errors?: Record<string, string[]> };
export async function saveExpense(_: ExpenseState, formData: FormData): Promise<ExpenseState> { const parsed = expenseFormSchema.safeParse(formValues(formData, ["expenseDate", "category", "vendor", "description", "amount", "paymentMethod", "jobId", "equipmentId", "notes"])); if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }; if (!parsed.data.expenseDate || parsed.data.amount === undefined) return { message: "Expense date and amount are required." }; const { business } = await requireBusinessContext(); try { await createExpense(await createClient(), { business_id: business.id, expense_date: parsed.data.expenseDate, category: parsed.data.category, vendor: parsed.data.vendor ?? null, description: parsed.data.description ?? null, amount: parsed.data.amount, payment_method: parsed.data.paymentMethod ?? null, job_id: parsed.data.jobId ?? null, equipment_id: parsed.data.equipmentId ?? null, notes: parsed.data.notes ?? null }); revalidatePath("/expenses"); revalidatePath("/dashboard"); redirect("/expenses"); } catch (error) { if (error && typeof error === "object" && "digest" in error) throw error; return { message: "The expense could not be saved." }; } }
