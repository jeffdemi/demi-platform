import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { suggestTaxCategory } from "@/lib/domain/accounting";
import { getBankTransaction } from "@/lib/repositories/accounting-repository";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { listExpenseCategories, listRefundableExpenseOptions } from "@/lib/repositories/expense-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../expense-form";
export const metadata: Metadata = { title: "Add expense" };
export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ refundOf?: string; bankTransaction?: string }> }) {
  const { refundOf, bankTransaction } = await searchParams;
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/expenses");
  const client = await createClient();
  const bankTransactionId = Number(bankTransaction);
  const [jobs, equipment, refundOptions, categories, bankRecord] = await Promise.all([
    listJobOptions(client, business.id),
    listActiveEquipmentOptions(client, business.id),
    listRefundableExpenseOptions(client, business.id),
    listExpenseCategories(client, business.id),
    Number.isInteger(bankTransactionId) ? getBankTransaction(client, business.id, bankTransactionId) : null,
  ]);
  const refundId = Number(refundOf);
  const source = refundOptions.find((expense) => expense.id === refundId);
  const description = source
    ? `Refund for ${source.description || source.vendor || `expense #${source.id}`}`
    : bankRecord?.description;
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description="Track operating expenses, asset purchases, refunds, and reconciled withdrawals without losing source records." title={source ? "Record refund" : "Add financial record"} />
    <ExpenseForm defaults={{
      expenseDate: bankRecord?.transaction_date ?? dateInTimeZone(business.timezone),
      transactionType: source ? "refund" : "expense",
      refundOfExpenseId: source?.id,
      bankTransactionId: bankRecord && bankRecord.amount < 0 ? bankRecord.id : undefined,
      paymentMethod: bankRecord && bankRecord.amount < 0 ? "business_account" : undefined,
      amount: bankRecord && bankRecord.amount < 0 ? Math.abs(bankRecord.amount) : undefined,
      category: source?.transaction_type === "asset" ? "Other" : undefined,
      vendor: source?.vendor ?? undefined,
      description,
      taxCategory: suggestTaxCategory({ vendor: source?.vendor, description }),
      deductiblePercent: source?.deductible_percent ?? 100,
      financialClassification: source?.financial_classification ?? "operating",
      laborClass: source?.labor_class ?? undefined,
    }} categories={categories} equipment={equipment} jobs={jobs} refundOptions={refundOptions} />
  </div>;
}
