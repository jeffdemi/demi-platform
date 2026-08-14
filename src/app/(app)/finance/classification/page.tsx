import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { listBusinessLines, listClassificationRecords, type BusinessLineFilter } from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";
import { ClassificationForm } from "../business-forms";

export const metadata: Metadata = { title: "Business Line Classification" };

export default async function ClassificationPage({ searchParams }: { searchParams: Promise<{ line?: string | string[] }> }) {
  const context = await requireBusinessContext(); const client = await createClient();
  const lines = await listBusinessLines(client, context.business.id);
  const requestedLine = (await searchParams).line;
  const rawFilter = Array.isArray(requestedLine) ? requestedLine[0] : requestedLine;
  const matchingLine = lines.find((line) => line.id.toString() === rawFilter);
  const filter: BusinessLineFilter = rawFilter === "all" ? "all" : matchingLine?.id ?? "unclassified";
  const selectedFilter = filter === "all" ? "all" : typeof filter === "number" ? filter.toString() : "unclassified";
  const records = await listClassificationRecords(client, context.business.id, filter);
  const groups = [
    { title: "Income / jobs", type: "job", rows: records.jobs.map((row) => ({ id: row.id, label: row.work_description || `Job #${row.id}`, detail: row.job_date || "Undated", amount: row.amount_paid, line: row.business_line_id })) },
    { title: "Expenses", type: "expense", rows: records.expenses.map((row) => ({ id: row.id, label: row.vendor || row.description || `Expense #${row.id}`, detail: row.expense_date, amount: row.amount, line: row.business_line_id })) },
    { title: "Assets / equipment", type: "equipment", rows: records.equipment.map((row) => ({ id: row.id, label: row.name, detail: "Equipment", amount: row.purchase_cost, line: row.business_line_id })) },
    { title: "Labor", type: "labor", rows: records.labor.map((row) => ({ id: row.id, label: row.worker_name, detail: row.period_end, amount: row.gross_wages, line: row.business_line_id })) },
    { title: "Payments", type: "payment", rows: records.payments.map((row) => ({ id: row.id, label: row.reference || `Payment #${row.id}`, detail: row.payment_date, amount: row.amount, line: row.business_line_id })) },
    { title: "Ledger entries", type: "journal_entry", rows: records.journals.map((row) => ({ id: row.id, label: row.description, detail: row.entry_date, amount: null, line: row.business_line_id })) },
  ];
  const visibleGroups = groups.filter((group) => group.rows.length);
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Apply one operating segment consistently to revenue, costs, assets, labor, payments, and posted ledger entries." title="Business Line Classification" /><div className="space-y-5 py-6"><form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm"><label className="text-sm font-semibold">Show records<select className="mt-1 block h-10 min-w-[260px] rounded-md border border-line-strong bg-surface px-3" defaultValue={selectedFilter} name="line"><option value="unclassified">Unclassified</option><option value="all">All records</option>{lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}</select></label><button className="h-10 rounded-md border border-line-strong px-4 font-semibold">Apply filter</button></form>{visibleGroups.map((group) => <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm" key={group.type}><h2 className="border-b border-line px-5 py-4 font-bold">{group.title}</h2><div className="divide-y divide-line">{group.rows.map((row) => <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3" key={row.id}><div className="min-w-[220px] flex-1"><p className="font-semibold">{row.label}</p><p className="text-sm text-muted">{row.detail}{row.amount !== null ? ` · ${formatCurrency(row.amount)}` : ""}</p></div><ClassificationForm currentLineId={row.line} key={`${row.id}:${row.line ?? "none"}`} lines={lines} recordId={row.id} recordType={group.type} /></div>)}</div></section>)}{!visibleGroups.length && <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted shadow-sm">{filter === "unclassified" ? "No unclassified records. Everything is assigned." : "No records match this filter."}</div>}</div></div>;
}
