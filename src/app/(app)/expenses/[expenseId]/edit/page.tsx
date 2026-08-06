import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { getExpense, listRefundableExpenseOptions } from "@/lib/repositories/expense-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../../expense-form";

export const metadata: Metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const expenseId = Number((await params).expenseId);
  if (!Number.isInteger(expenseId)) notFound();
  const { business } = await requireBusinessContext();
  const client = await createClient();
  const [expense, jobs, equipment, refundOptions] = await Promise.all([
    getExpense(client, business.id, expenseId),
    listJobOptions(client, business.id),
    listActiveEquipmentOptions(client, business.id),
    listRefundableExpenseOptions(client, business.id),
  ]);
  if (!expense) notFound();
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Correct classification and source details while preserving the original record ID." title="Edit financial record" /><ExpenseForm defaults={{ expenseDate: expense.expense_date, category: expense.category, vendor: expense.vendor ?? undefined, description: expense.description ?? undefined, amount: expense.amount, paymentMethod: expense.payment_method ?? undefined, jobId: expense.job_id ?? undefined, equipmentId: expense.equipment_id ?? undefined, notes: expense.notes ?? undefined, transactionType: expense.transaction_type, refundOfExpenseId: expense.refund_of_expense_id ?? undefined, bankTransactionId: expense.bank_transaction_id ?? undefined, taxCategory: expense.tax_category ?? undefined, deductiblePercent: expense.deductible_percent, hasReceipt: Boolean(expense.receipt_path) }} equipment={equipment} expenseId={expense.id} jobs={jobs} refundOptions={refundOptions.filter((option) => option.id !== expense.id)} /></div>;
}
