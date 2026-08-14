import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Landmark } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { buildMonthEndChecklist } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import { getMonthEndInputs } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { MonthEndForm } from "./month-end-form";

export const metadata: Metadata = { title: "Month End" };

function monthEnd(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

export default async function MonthEndPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/dashboard");
  const requested = (await searchParams).month;
  const currentMonth = dateInTimeZone(context.business.timezone).slice(0, 7);
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth;
  const periodMonth = `${month}-01`;
  const inputs = await getMonthEndInputs(await createClient(), context.business.id, periodMonth, monthEnd(month));
  const checklist = buildMonthEndChecklist({
    settingsConfigured: Boolean(inputs.settings?.owner_market_salary_annual),
    ownerCompensationRecorded: inputs.ownerCompensationRecorded,
    hasNonOwnerLabor: inputs.settings?.has_non_owner_labor ?? false,
    laborRecorded: inputs.laborRecorded,
    unreviewedExpenseClassifications: inputs.unreviewedExpenseClassifications,
    unreviewedBankTransactions: inputs.unreviewedBankTransactions,
    snapshot: inputs.snapshot,
    expectedAccountsReceivable: inputs.expectedAccountsReceivable,
    incompleteEquipmentSchedules: inputs.incompleteEquipmentSchedules,
  });
  const completed = checklist.filter((item) => item.complete).length;
  const snapshot = inputs.snapshot;
  const cashDifference = snapshot ? snapshot.cash_bank_balance - snapshot.cash_book_balance : null;
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><Landmark size={17} />Finance</Link>} description="Reconcile balances and confirm the inputs required for trustworthy management reports." title="Month-End Close" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">{[["Checklist", `${completed} / ${checklist.length}`], ["Book cash", formatCurrency(snapshot?.cash_book_balance)], ["Bank cash", formatCurrency(snapshot?.cash_bank_balance)], ["Cash difference", cashDifference === null ? "Not entered" : formatCurrency(cashDifference)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Close checklist</h2><form><input className="h-9 rounded-md border border-line-strong bg-surface px-2" defaultValue={month} name="month" type="month" /><button className="ml-2 h-9 rounded-md border border-line-strong px-3 font-semibold">Load</button></form></div><div className="mt-4 divide-y divide-line">{checklist.map((item) => <Link className="flex items-start gap-3 py-3 hover:text-brand" href={item.href} key={item.key}>{item.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} /> : <CircleAlert className="mt-0.5 shrink-0 text-danger" size={18} />}<span className="min-w-0"><strong className="block text-sm">{item.label}</strong>{item.detail ? <span className="text-xs text-muted">{item.detail}</span> : null}</span></Link>)}</div></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Balance snapshot</h2><p className="mt-1 text-sm leading-6 text-muted">Enter month-end balances from your books and statements. Saving the same month updates the existing snapshot.</p><MonthEndForm month={month} snapshot={snapshot} /></section>
    </div>
  </div>;
}
