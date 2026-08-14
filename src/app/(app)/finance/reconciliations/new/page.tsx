import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listBankAccounts } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { StatementPeriodForm } from "../../bookkeeping-forms";

export const metadata: Metadata = { title: "New Reconciliation" };

export default async function NewReconciliationPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/finance");
  const accounts = await listBankAccounts(await createClient(), context.business.id);
  const requested = Number((await searchParams).account);
  const defaultAccountId = accounts.some((account) => account.id === requested) ? requested : undefined;
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Use the dates and balances printed on the statement. Imported rows in the date range are attached automatically." title="Start Statement Reconciliation" />
    <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm"><StatementPeriodForm accounts={accounts} defaultAccountId={defaultAccountId} /></section>
  </div>;
}
