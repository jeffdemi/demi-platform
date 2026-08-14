import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { listBusinessLines, listClassificationRecords } from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";
import { ClassificationForm } from "../business-forms";

export const metadata: Metadata = { title: "Business Line Classification" };

export default async function ClassificationPage() {
  const context = await requireBusinessContext(); const client = await createClient();
  const [lines, records] = await Promise.all([listBusinessLines(client, context.business.id), listClassificationRecords(client, context.business.id)]);
  const groups = [
    { title: "Income / jobs", type: "job", rows: records.jobs.map((row) => ({ id: row.id, label: row.work_description || `Job #${row.id}`, detail: row.job_date || "Undated", amount: row.amount_paid, line: row.business_line_id })) },
    { title: "Expenses", type: "expense", rows: records.expenses.map((row) => ({ id: row.id, label: row.vendor || row.description || `Expense #${row.id}`, detail: row.expense_date, amount: row.amount, line: row.business_line_id })) },
    { title: "Assets / equipment", type: "equipment", rows: records.equipment.map((row) => ({ id: row.id, label: row.name, detail: "Equipment", amount: row.purchase_cost, line: row.business_line_id })) },
    { title: "Labor", type: "labor", rows: records.labor.map((row) => ({ id: row.id, label: row.worker_name, detail: row.period_end, amount: row.gross_wages, line: row.business_line_id })) },
    { title: "Payments", type: "payment", rows: records.payments.map((row) => ({ id: row.id, label: row.reference || `Payment #${row.id}`, detail: row.payment_date, amount: row.amount, line: row.business_line_id })) },
    { title: "Ledger entries", type: "journal_entry", rows: records.journals.map((row) => ({ id: row.id, label: row.description, detail: row.entry_date, amount: null, line: row.business_line_id })) },
  ];
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Apply one operating segment consistently to revenue, costs, assets, labor, payments, and posted ledger entries." title="Business Line Classification" /><div className="space-y-5 py-6">{groups.map((group) => <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm" key={group.type}><h2 className="border-b border-line px-5 py-4 font-bold">{group.title}</h2><div className="divide-y divide-line">{group.rows.map((row) => <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3" key={row.id}><div className="min-w-[220px] flex-1"><p className="font-semibold">{row.label}</p><p className="text-sm text-muted">{row.detail}{row.amount !== null ? ` · ${formatCurrency(row.amount)}` : ""}</p></div><ClassificationForm currentLineId={row.line} lines={lines} recordId={row.id} recordType={group.type} /></div>)}{!group.rows.length && <p className="px-5 py-6 text-sm text-muted">No records.</p>}</div></section>)}</div></div>;
}
