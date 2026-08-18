import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, FileBarChart, FilePlus2, Landmark, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { buildMonthEndChecklist } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import { getMonthEndInputs } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { MonthEndForm } from "./month-end-form";
import { CloseMonthForm, ReopenMonthForm } from "./close-forms";

export const metadata: Metadata = { title: "Month End" };

function monthEnd(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

export default async function MonthEndPage({ searchParams }: { searchParams: Promise<{ month?: string; origin?: string }> }) {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) redirect("/dashboard");
  const query = await searchParams;
  const requested = query.month;
  const fromReports = query.origin === "reports";
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
    unreconciledBankAccounts: inputs.unreconciledBankAccounts,
    snapshot: inputs.snapshot,
    expectedAccountsReceivable: inputs.expectedAccountsReceivable,
    incompleteEquipmentSchedules: inputs.incompleteEquipmentSchedules,
  });
  const completed = checklist.filter((item) => item.complete).length;
  const allComplete = completed === checklist.length;
  const snapshot = inputs.snapshot;
  const cashDifference = snapshot ? snapshot.cash_bank_balance - snapshot.cash_book_balance : null;
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={fromReports ? <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports"><FileBarChart size={17} />Reports</Link> : <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><Landmark size={17} />Finance</Link>} description="Reconcile balances and confirm the inputs required for trustworthy management reports." title="Month-End Close" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-5">{[["Close status", snapshot?.close_status ?? "open"], ["Checklist", `${completed} / ${checklist.length}`], ["Book cash", formatCurrency(snapshot?.cash_book_balance)], ["Bank cash", formatCurrency(snapshot?.cash_bank_balance)], ["Cash difference", cashDifference === null ? "Not entered" : formatCurrency(cashDifference)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums capitalize">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Close checklist</h2><form><input className="h-9 rounded-md border border-line-strong bg-surface px-2" defaultValue={month} name="month" type="month" /><button className="ml-2 h-9 rounded-md border border-line-strong px-3 font-semibold">Load</button></form></div><div className="mt-4 divide-y divide-line">{checklist.map((item) => <Link className="flex items-start gap-3 py-3 hover:text-brand" href={item.href} key={item.key}>{item.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} /> : <CircleAlert className="mt-0.5 shrink-0 text-danger" size={18} />}<span className="min-w-0"><strong className="block text-sm">{item.label}</strong>{item.detail ? <span className="text-xs text-muted">{item.detail}</span> : null}</span></Link>)}</div></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Balance snapshot</h2><p className="mt-1 text-sm leading-6 text-muted">Enter month-end balances from your books and statements. Saving the same month updates the existing snapshot.</p>{snapshot?.close_status === "closed" ? <div className="mt-5 rounded-md border border-line bg-surface-muted p-4 text-sm"><p className="font-bold">Balances locked</p><p className="mt-1 text-muted">Reopen the accounting month before changing this snapshot or any dated source records.</p></div> : <MonthEndForm month={month} snapshot={snapshot} />}</section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="font-bold">Account reconciliations</h2><p className="mt-1 text-sm text-muted">Every active bank and credit account needs one reconciled statement ending in this month.</p></div><Link aria-label="New reconciliation" className="flex size-9 items-center justify-center rounded-md border border-line-strong" href="/finance/reconciliations/new"><FilePlus2 size={16} /></Link></div><div className="divide-y divide-line">{inputs.bankAccounts.map((account) => { const period = inputs.statementPeriods.find((item) => item.account_id === account.id); return <div className="flex items-center justify-between gap-4 px-5 py-4" key={account.id}><div><p className="font-semibold">{account.name}</p><p className="text-sm text-muted">{period ? `${period.statement_start_date} through ${period.statement_end_date}` : "No statement period"}</p></div>{period ? <Link className="flex items-center gap-2" href={`/finance/reconciliations/${period.id}`}><StatusBadge label={period.status} status={period.status} /></Link> : <Link className="font-semibold text-brand" href={`/finance/reconciliations/new?account=${account.id}`}>Start</Link>}</div>; })}{!inputs.bankAccounts.length ? <p className="px-5 py-8 text-sm text-muted">Add a bank or credit account in Finance before closing the books.</p> : null}</div></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><LockKeyhole className="text-brand" size={18} /><h2 className="font-bold">Accounting lock</h2></div>{snapshot?.close_status === "closed" ? <><p className="my-4 text-sm leading-6 text-muted">This month is closed. Dated payments, expenses, bank transactions, labor, owner compensation, and adjustments are protected.</p><ReopenMonthForm periodMonth={periodMonth} /></> : <><p className="my-4 text-sm leading-6 text-muted">Closing preserves a clean cutoff. Corrections require a recorded reopen reason.</p><CloseMonthForm disabled={!allComplete} periodMonth={periodMonth} /></>}</section>
    </div>
  </div>;
}
