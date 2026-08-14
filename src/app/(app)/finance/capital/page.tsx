import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatCurrency, formatDate } from "@/lib/format";
import { listBankAccounts } from "@/lib/repositories/accounting-repository";
import { listBusinessLines, listCapitalTransactions } from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";
import { CapitalTransactionForm } from "../business-forms";
export const metadata: Metadata = { title: "Owner Activity" };
export default async function CapitalPage() { const context = await requireBusinessContext(); const client = await createClient(); const [lines, accounts, activity] = await Promise.all([listBusinessLines(client, context.business.id), listBankAccounts(client, context.business.id), listCapitalTransactions(client, context.business.id)]); return <div className="mx-auto w-full max-w-[1200px] px-4 py-6"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Keep contributions, loans, repayments, draws, and estimated taxes out of operating expenses." title="Owner & Capital Activity" /><div className="grid gap-5 py-6 lg:grid-cols-[1fr_430px]"><section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="divide-y divide-line">{activity.map((row) => <div className="flex items-center justify-between gap-4 px-5 py-4" key={row.id}><div><p className="font-semibold">{row.transaction_type.replaceAll("_", " ")}</p><p className="text-sm text-muted">{formatDate(row.transaction_date)} · {row.memo}</p></div><strong>{formatCurrency(row.amount)}</strong></div>)}{!activity.length && <p className="p-8 text-sm text-muted">No owner or related-party activity recorded.</p>}</div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="mb-4 font-bold">Record activity</h2><CapitalTransactionForm bankAccounts={accounts} defaultDate={dateInTimeZone(context.business.timezone)} lines={lines} /></section></div></div>; }
