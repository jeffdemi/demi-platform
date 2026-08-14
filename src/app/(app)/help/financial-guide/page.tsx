import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Calculator, CheckCircle2, Landmark, ReceiptText, Settings, UsersRound, Wrench } from "lucide-react";
import { FinancialGlossary } from "@/components/financial-glossary";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Financial Guide" };

const workflow = [
  { title: "Set the rules", description: "Choose the reporting basis, owner market salary, and management targets.", href: "/reports/settings", icon: Settings },
  { title: "Classify spending", description: "Review expenses as COGS, operating, labor, asset, or owner distribution.", href: "/expenses?classificationReview=missing", icon: ReceiptText },
  { title: "Record labor", description: "Enter wages, payroll burden, hours, and labor class for each pay period.", href: "/labor", icon: UsersRound },
  { title: "Track ownership", description: "Record monthly owner wages, distributions, contributions, and market pay.", href: "/reports/settings#owner-compensation", icon: Calculator },
  { title: "Update equipment", description: "Maintain depreciation assumptions and current equipment loan balances.", href: "/equipment", icon: Wrench },
  { title: "Reconcile the books", description: "Prove every statement against imported rows and balanced journal activity.", href: "/finance/reconciliations/new", icon: Landmark },
  { title: "Review statements", description: "Check the trial balance, P&L, balance sheet, and cash flow.", href: "/reports/books", icon: BookOpen },
  { title: "Close the month", description: "Resolve missing information, save balances, and lock the completed period.", href: "/finance/month-end", icon: Landmark },
  { title: "Review results", description: "Read normalized profit, LER, core capital, and ROIC together.", href: "/reports", icon: BookOpen },
] as const;

const sectionLinks = [
  ["Workflow", "financial-workflow"],
  ["Expense classes", "expense-classifications"],
  ["Labor", "labor-payroll"],
  ["Owner compensation", "owner-compensation"],
  ["Bookkeeping", "bookkeeping"],
  ["Month end", "month-end"],
  ["Equipment", "equipment-finance"],
  ["Metrics", "reporting-metrics"],
  ["Glossary", "financial-glossary"],
] as const;

export default function FinancialGuidePage() {
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports"><ArrowLeft aria-hidden="true" size={17} />Reports</Link>} description="Definitions, formulas, data sources, and the monthly process behind management reporting." title="Financial Guide" />

    <nav aria-label="Financial guide sections" className="flex gap-2 overflow-x-auto border-b border-line py-4">
      {sectionLinks.map(([label, anchor]) => <a className="h-9 shrink-0 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted" href={`#${anchor}`} key={anchor}>{label}</a>)}
    </nav>

    <section className="scroll-mt-5 py-7" id="financial-workflow">
      <div className="max-w-3xl"><p className="text-xs font-bold uppercase text-brand">Monthly operating rhythm</p><h2 className="mt-2 text-2xl font-bold">From source records to a trustworthy report</h2><p className="mt-2 leading-7 text-muted">Complete the work from left to right. Each step improves the quality of every metric that follows it.</p></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workflow.map(({ title, description, href, icon: Icon }, index) => <Link className="group flex min-h-40 flex-col border-l-4 border-brand bg-surface p-4 shadow-sm hover:bg-brand-soft" href={href} key={title}>
          <div className="flex items-center justify-between gap-3"><span className="grid size-9 place-items-center rounded-md bg-brand text-on-brand"><Icon aria-hidden="true" size={18} /></span><span className="text-xs font-bold text-muted">Step {index + 1}</span></div>
          <h3 className="mt-4 font-bold group-hover:text-brand">{title}</h3><p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        </Link>)}
      </div>
    </section>

    <section className="border-y border-line py-6" id="monthly-workflow">
      <h2 className="text-xl font-bold">Month-end sequence</h2>
      <ol className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
        {["Review and classify every expense.", "Record labor, owner compensation, and equity activity.", "Import every bank and credit-card statement.", "Split, match, transfer, or exclude every imported row.", "Reconcile imported and book activity to each statement.", "Review the trial balance and financial statements.", "Enter the balance snapshot and resolve checklist exceptions.", "Close and lock the month, then review management metrics."].map((item, index) => <li className="flex gap-3 text-sm leading-6" key={item}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">{index + 1}</span><span>{item}</span></li>)}
      </ol>
    </section>

    <div className="grid gap-x-10 gap-y-8 py-8 lg:grid-cols-2">
      <section className="scroll-mt-5" id="expense-classifications"><h2 className="text-xl font-bold">Expense classifications</h2><p className="mt-2 text-sm leading-6 text-muted">Use COGS for direct non-labor delivery costs, operating for overhead, labor only for labor outside payroll detail, asset for long-lived purchases, and owner distribution for returns on ownership. Tax category and deductibility remain separate decisions.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/expenses?classificationReview=missing">Review unclassified expenses</Link></section>
      <section className="scroll-mt-5" id="labor-payroll"><h2 className="text-xl font-bold">Labor and payroll</h2><p className="mt-2 text-sm leading-6 text-muted">Separate direct, management, and sales labor. Record gross wages, employer payroll taxes, benefits, hours, and the covered period. Never duplicate payroll as a labor-classified expense.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/labor">Open Labor & Payroll</Link></section>
      <section className="scroll-mt-5" id="owner-compensation"><h2 className="text-xl font-bold">Owner compensation</h2><p className="mt-2 text-sm leading-6 text-muted">Management reports replace actual owner wages with a market-rate wage. Distributions are returns on ownership and do not reduce operating profit; contributions represent owner capital added to the company.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/reports/settings">Open owner compensation</Link></section>
      <section className="scroll-mt-5" id="bookkeeping"><h2 className="text-xl font-bold">Bookkeeping and reconciliation</h2><p className="mt-2 text-sm leading-6 text-muted">For every bank and credit-card statement, prove both the imported activity and the posted journal balance. Split mixed purchases, pair transfers between business accounts, and use balanced adjustments for noncash or correcting entries.</p><div className="mt-3 flex flex-wrap gap-4"><Link className="font-semibold text-brand" href="/finance/reconciliations/new">Start reconciliation</Link><Link className="font-semibold text-brand" href="/reports/books">Review financial statements</Link></div></section>
      <section className="scroll-mt-5" id="month-end"><h2 className="text-xl font-bold">Month-end balances</h2><p className="mt-2 text-sm leading-6 text-muted">Capture book cash, bank cash, receivables, payables, inventory, fixed assets, taxes, credit cards, and debt. Reconcile cash and compare receivables with unpaid invoices before relying on capital metrics.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/finance/month-end">Open Month-End Close</Link></section>
      <section className="scroll-mt-5" id="equipment-finance"><h2 className="text-xl font-bold">Equipment finance</h2><p className="mt-2 text-sm leading-6 text-muted">Management depreciation uses purchase cost, salvage value, in-service date, and useful life. Current lender balances support invested-capital reporting but do not replace official payoff statements.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/equipment">Review equipment</Link></section>
      <section className="scroll-mt-5" id="reporting-metrics"><h2 className="text-xl font-bold">Reporting metrics</h2><p className="mt-2 text-sm leading-6 text-muted">Read profit, LER, salary capacity, core capital, and ROIC as a group. A metric marked Not ready is missing a required denominator or month-end balance rather than being zero.</p><Link className="mt-3 inline-flex font-semibold text-brand" href="/reports">Open Reports</Link></section>
    </div>

    <section className="scroll-mt-5 pb-8" id="financial-glossary">
      <div className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-brand" size={21} /><div><h2 className="text-2xl font-bold">Definitions and formulas</h2><p className="mt-1 leading-7 text-muted">Search the same definitions used by the inline information buttons throughout the app.</p></div></div>
      <div className="mt-5"><FinancialGlossary /></div>
    </section>

    <aside className="border-t border-line py-5 text-sm leading-6 text-muted">These are management estimates for operating decisions. Your accountant remains the authority for tax depreciation, formal financial statements, and filing treatment.</aside>
  </div>;
}
