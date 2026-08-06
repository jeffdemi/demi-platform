import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { listRefundableExpenseOptions } from "@/lib/repositories/expense-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../expense-form";
export const metadata: Metadata = { title: "Add expense" };
export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ refundOf?: string }> }) { const { refundOf } = await searchParams; const { business } = await requireBusinessContext(); const client = await createClient(); const [jobs, equipment, refundOptions] = await Promise.all([listJobOptions(client, business.id), listActiveEquipmentOptions(client, business.id), listRefundableExpenseOptions(client, business.id)]); const refundId = Number(refundOf); const source = refundOptions.find((expense) => expense.id === refundId); return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Track operating expenses, asset purchases, and refunds without losing source records." title={source ? "Record refund" : "Add financial record"} /><ExpenseForm defaults={{ expenseDate: dateInTimeZone(business.timezone), transactionType: source ? "refund" : "expense", refundOfExpenseId: source?.id, category: source?.transaction_type === "asset" ? "Other" : undefined, vendor: source?.vendor ?? undefined, description: source ? `Refund for ${source.description || source.vendor || `expense #${source.id}`}` : undefined }} equipment={equipment} jobs={jobs} refundOptions={refundOptions} /></div>; }
