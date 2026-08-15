import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { cashOutflowImpact, expenseCategories, expenseTypeOptions, operatingExpenseImpact } from "@/lib/domain/finance";
import { financialClassificationOptions } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import { listExpenses } from "@/lib/repositories/expense-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseClassificationTable } from "./expense-classification-table";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ type?: string; category?: string; classification?: string; classificationReview?: string; archived?: string }> }) {
  const filters = await searchParams;
  const context = await requireBusinessContext();
  const { business } = context;
  const expenses = await listExpenses(await createClient(), business.id, {
    transactionType: filters.type,
    category: filters.category,
    financialClassification: filters.classification,
    classificationReview: filters.classificationReview,
    includeVoided: filters.archived === "1",
  });
  const active = expenses.filter((expense) => !expense.voided_at);
  const operating = active.reduce((sum, expense) => sum + operatingExpenseImpact(expense), 0);
  const assets = active.filter((expense) => expense.transaction_type === "asset").reduce((sum, expense) => sum + expense.amount, 0);
  const refunds = active.filter((expense) => expense.transaction_type === "refund").reduce((sum, expense) => sum + expense.amount, 0);
  const cashOutflow = active.reduce((sum, expense) => sum + cashOutflowImpact(expense), 0);
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/expenses/new"><Plus size={18} />Add record</Link>} description={`${active.length} active record${active.length === 1 ? "" : "s"}`} title="Expenses" />
    <section className="grid grid-cols-2 gap-3 py-5 lg:grid-cols-4"><div className="rounded-lg border border-line bg-surface p-4"><p className="text-xl font-bold tabular-nums">{formatCurrency(operating)}</p><p className="mt-1 text-xs text-muted">Net operating expense</p></div><div className="rounded-lg border border-line bg-surface p-4"><p className="text-xl font-bold tabular-nums">{formatCurrency(assets)}</p><p className="mt-1 text-xs text-muted">Asset purchases</p></div><div className="rounded-lg border border-line bg-surface p-4"><p className="text-xl font-bold tabular-nums">{formatCurrency(refunds)}</p><p className="mt-1 text-xs text-muted">Refunds / credits</p></div><div className="rounded-lg border border-line bg-surface p-4"><p className="text-xl font-bold tabular-nums">{formatCurrency(cashOutflow)}</p><p className="mt-1 text-xs text-muted">Net cash outflow</p></div></section>
    <form className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto]"><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue={filters.type ?? ""} name="type"><option value="">All record types</option>{expenseTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue={filters.category ?? ""} name="category"><option value="">All categories</option>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue={filters.classification ?? ""} name="classification"><option value="">All management classes</option>{financialClassificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label className="flex h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm"><input defaultChecked={filters.classificationReview === "missing"} name="classificationReview" type="checkbox" value="missing" />Needs classification review</label><button className="h-11 rounded-md border border-line-strong px-4 font-semibold">Apply</button><label className="flex h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm"><input defaultChecked={filters.archived === "1"} name="archived" type="checkbox" value="1" />Include archived</label></form>
    <ExpenseClassificationTable canClassify={context.role !== "employee"} expenses={expenses} />
  </div>;
}
