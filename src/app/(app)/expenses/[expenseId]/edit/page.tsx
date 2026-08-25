import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { getExpense, listExpenseCategories, listRefundableExpenseOptions } from "@/lib/repositories/expense-repository";
import { createReceiptUrl } from "@/lib/services/expenses";
import { isExpenseAiConfigured } from "@/lib/services/expense-ai";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../../expense-form";

export const metadata: Metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const expenseId = Number((await params).expenseId);
  if (!Number.isInteger(expenseId)) notFound();
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect(`/expenses/${expenseId}`);
  const client = await createClient();
  const [expense, jobs, equipment, refundOptions, categories] = await Promise.all([
    getExpense(client, business.id, expenseId),
    listJobOptions(client, business.id),
    listActiveEquipmentOptions(client, business.id),
    listRefundableExpenseOptions(client, business.id),
    listExpenseCategories(client, business.id),
  ]);
  if (!expense) notFound();
  const receiptUrl = await createReceiptUrl(client, expense.receipt_path);
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Correct classification and source details while preserving the original record ID." title="Edit financial record" />{expense.bank_transaction_id ? <div className="mb-5 rounded-lg border border-brand-border bg-brand-soft p-4 text-sm leading-6"><strong>Matched expense:</strong> Vendor, description, category, classification, tax details, business links, receipt, and notes can be corrected safely. Changing the amount or date must still agree with imported transaction #{expense.bank_transaction_id} or the save will be rejected.</div> : null}<ExpenseForm defaults={{ expenseDate: expense.expense_date, category: expense.category, vendor: expense.vendor ?? undefined, description: expense.description ?? undefined, amount: expense.amount, paymentMethod: expense.payment_method ?? undefined, jobId: expense.job_id ?? undefined, equipmentId: expense.equipment_id ?? undefined, notes: expense.notes ?? undefined, transactionType: expense.transaction_type, refundOfExpenseId: expense.refund_of_expense_id ?? undefined, bankTransactionId: expense.bank_transaction_id ?? undefined, taxCategory: expense.tax_category ?? undefined, deductiblePercent: expense.deductible_percent, financialClassification: expense.financial_classification, laborClass: expense.labor_class ?? undefined, hasReceipt: Boolean(expense.receipt_path), receiptUrl: receiptUrl ?? undefined }} aiConfigured={isExpenseAiConfigured()} categories={categories} equipment={equipment} expenseId={expense.id} jobs={jobs} refundOptions={refundOptions.filter((option) => option.id !== expense.id)} /></div>;
}
