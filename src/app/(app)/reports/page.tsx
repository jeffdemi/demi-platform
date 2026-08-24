import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarCheck, CalendarRange, Download, Settings } from "lucide-react";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildTaxExpenseSummary, trialBalance } from "@/lib/domain/accounting";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { buildCrabtreeReport, normalizeFinancialSettings } from "@/lib/domain/management-accounting";
import { buildReportSummary } from "@/lib/domain/reports";
import { formatCurrency } from "@/lib/format";
import { getLedgerReport, getTaxExpenses } from "@/lib/repositories/accounting-repository";
import { getCrabtreeReportData } from "@/lib/repositories/management-accounting-repository";
import { getReportData } from "@/lib/repositories/reporting-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

function formatPercent(value: number | null) {
  return value === null ? "Not ready" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null) {
  return value === null ? "Not ready" : value.toFixed(2);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const context = await requireBusinessContext();
  const requestedYear = Number((await searchParams).year);
  const currentDate = dateInTimeZone(context.business.timezone);
  const currentYear = Number(currentDate.slice(0, 4));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : currentYear;
  const from = `${year}-01-01`;
  const to = year === currentYear ? currentDate : `${year}-12-31`;
  const client = await createClient();
  const [reportData, taxExpenses, ledger, managementData] = await Promise.all([
    getReportData(client, context.business.id),
    getTaxExpenses(client, context.business.id, year),
    getLedgerReport(client, context.business.id, from, to),
    (context.role === "employee" || context.role === "intern") ? null : getCrabtreeReportData(client, context.business.id, from, to),
  ]);
  const report = buildReportSummary(reportData);
  const tax = buildTaxExpenseSummary(taxExpenses);
  const balance = trialBalance(ledger.lines);
  const settings = managementData ? normalizeFinancialSettings(managementData.settings) : null;
  const management = managementData && settings
    ? buildCrabtreeReport({ ...managementData, settings, from, to })
    : null;
  const cashCards = [
    ["Paid revenue", formatCurrency(report.paidRevenue)],
    ["Operating expense", formatCurrency(report.operatingExpenses)],
    ["Cash operating surplus", formatCurrency(report.net)],
    ["Asset purchases", formatCurrency(report.assetPurchases)],
    ["Refunds / credits", formatCurrency(report.refunds)],
    ["Net cash outflow", formatCurrency(report.cashOutflow)],
    ["Cash net", formatCurrency(report.cashNet)],
    ["Outstanding invoices", formatCurrency(report.outstandingInvoices)],
    ["Quoted pipeline", formatCurrency(report.quotedPipeline)],
    ["Quote acceptance", `${report.acceptanceRate}%`],
  ];
  const actions = (context.role === "employee" || context.role === "intern") ? null : <div className="flex flex-wrap gap-2">
    <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports/books"><BookOpenCheck size={17} />Bookkeeping statements</Link>
    <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports/monthly"><CalendarRange size={17} />Monthly reports</Link>
    <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports/settings"><Settings size={17} />Targets & owner pay</Link>
    <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/finance/month-end?origin=reports"><CalendarCheck size={17} />Month-end close</Link>
  </div>;
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={actions} description="Management performance, cash reporting, tax preparation, and a source-linked general ledger." title="Reports" />

    {management && settings ? <>
      <section className="py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-bold">Simple Numbers scorecard</h2><p className="mt-1 text-sm text-muted">{year} year to date using {settings.reporting_basis} revenue and normalized owner compensation.</p></div>
          <form><input className="h-9 w-24 rounded-md border border-line-strong bg-surface px-2" defaultValue={year} max="2100" min="2000" name="year" type="number" /><button className="ml-2 h-9 rounded-md border border-line-strong px-3 font-semibold">Load</button></form>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Pretax profit", formatCurrency(management.pretaxProfit), `Target ${formatPercent(settings.target_profit_to_gross_margin)} of gross margin`, "pretax-profit"],
            ["Profit / gross margin", formatPercent(management.profitToGrossMargin), `Minimum ${formatPercent(settings.minimum_profit_to_gross_margin)}`, "profit-to-gross-margin"],
            ["Total LER", formatRatio(management.totalLer), `Target ${settings.target_total_ler.toFixed(2)}`, "total-ler"],
            ["Salary headroom", formatCurrency(management.salaryHeadroom), `Salary cap ${formatCurrency(management.salaryCap)}`, "salary-headroom"],
            ["Core capital", management.coreCapitalActual === null ? "Not ready" : formatCurrency(management.coreCapitalActual), `Target ${formatCurrency(management.coreCapitalTarget)}`, "core-capital"],
            ["Annualized ROIC", formatPercent(management.roic), `Minimum ${formatPercent(settings.minimum_roic)}`, "roic"],
          ].map(([label, value, note, termId]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><div className="mt-1 flex items-center gap-1"><p className="text-xs font-semibold">{label}</p><FinancialTermHelp termId={termId} /></div><p className="mt-1 text-xs text-muted">{note}</p></div>)}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-5 py-4"><h2 className="font-bold">Normalized management P&L</h2><p className="mt-1 text-sm text-muted">Owner labor is included at market rate. Asset purchases and owner distributions are excluded from operating profit.</p></div>
          <table className="w-full text-sm"><tbody className="divide-y divide-line">
            {[
              ["Revenue", management.revenue, true],
              ["Cost of goods sold", management.cogs, false],
              ["Gross margin", management.grossMargin, true],
              ["Direct labor", management.directLabor, false],
              ["Contribution margin", management.contributionMargin, true],
              ["Management labor", management.managementLabor, false],
              ["Sales labor", management.salesLabor, false],
              ["Payroll taxes & benefits", management.payrollBurden, false],
              ["Operating expenses", management.operatingExpenses, false],
              ["Management depreciation", management.depreciation, false],
              ["Pretax profit", management.pretaxProfit, true],
            ].map(([label, value, emphasized]) => <tr className={emphasized ? "bg-surface-muted font-bold" : ""} key={String(label)}><td className="px-5 py-3">{label}</td><td className="px-5 py-3 text-right tabular-nums">{formatCurrency(Number(value))}</td></tr>)}
          </tbody></table>
        </section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-bold">Labor & ownership</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="flex items-center gap-1 text-muted">Direct LER<FinancialTermHelp termId="direct-ler" /></dt><dd className="mt-1 text-lg font-bold">{formatRatio(management.directLer)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Management LER<FinancialTermHelp termId="management-ler" /></dt><dd className="mt-1 text-lg font-bold">{formatRatio(management.managementLer)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Owner market wage<FinancialTermHelp termId="owner-market-salary" /></dt><dd className="mt-1 font-bold">{formatCurrency(management.ownerMarketWage)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Actual owner wages<FinancialTermHelp termId="actual-owner-wages" /></dt><dd className="mt-1 font-bold">{formatCurrency(management.ownerActualWages)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Owner distributions<FinancialTermHelp termId="owner-distributions" /></dt><dd className="mt-1 font-bold">{formatCurrency(management.ownerDistributions)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Owner contributions<FinancialTermHelp termId="owner-contributions" /></dt><dd className="mt-1 font-bold">{formatCurrency(management.ownerContributions)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Invested capital<FinancialTermHelp termId="invested-capital" /></dt><dd className="mt-1 font-bold">{management.investedCapital === null ? "Not ready" : formatCurrency(management.investedCapital)}</dd></div>
            <div><dt className="flex items-center gap-1 text-muted">Core capital surplus<FinancialTermHelp termId="core-capital-surplus" /></dt><dd className="mt-1 font-bold">{management.coreCapitalSurplus === null ? "Not ready" : formatCurrency(management.coreCapitalSurplus)}</dd></div>
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">Management estimates support operating decisions. Your accountant remains the source for tax depreciation, formal financial statements, and filing treatment.</p>
        </section>
      </div>
    </> : null}

    <section className="mt-6">
      <h2 className="text-lg font-bold">Cash operations</h2>
      <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 xl:grid-cols-5">{cashCards.map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Monthly cash performance</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Operating</th><th className="px-4 py-3 text-right">Assets</th><th className="px-4 py-3 text-right">Refunds</th><th className="px-4 py-3 text-right">Cash operating surplus</th><th className="px-4 py-3 text-right">Cash net</th></tr></thead><tbody className="divide-y divide-line">{report.months.map((month) => <tr key={month.month}><td className="px-4 py-3 font-semibold">{month.month}</td><td className="px-4 py-3 text-right">{formatCurrency(month.revenue)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.operatingExpenses)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.assetPurchases)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.refunds)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.net)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.cashNet)}</td></tr>)}</tbody></table></div></section>
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Tax preparation</h2><form><input className="h-9 w-24 rounded-md border border-line-strong bg-surface px-2" defaultValue={year} max="2100" min="2000" name="year" type="number" /><button className="ml-2 h-9 rounded-md border border-line-strong px-3 font-semibold">Load</button></form></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">Deductible operating</dt><dd className="font-bold">{formatCurrency(tax.deductibleOperating)}</dd></div><div><dt className="text-muted">Asset purchases</dt><dd className="font-bold">{formatCurrency(tax.assetPurchases)}</dd></div><div><dt className="text-muted">Purchase refunds</dt><dd className="font-bold">{formatCurrency(tax.refunds)}</dd></div><div><dt className="text-muted">Ledger</dt><dd className={`font-bold ${balance.balanced ? "text-brand" : "text-danger"}`}>{balance.balanced ? "Balanced" : "Review required"}</dd></div></dl><div className="mt-4 space-y-2">{tax.categories.slice(0, 8).map(([category, amount]) => <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm" key={category}><span>{category}</span><strong>{formatCurrency(amount)}</strong></div>)}</div></section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Operating expense by category</h2><div className="mt-3 space-y-2">{report.categories.map(([category, amount]) => <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm" key={category}><span>{category}</span><strong>{formatCurrency(amount)}</strong></div>)}{!report.categories.length && <p className="text-sm text-muted">No operating expenses.</p>}</div></section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Exports & API</h2><div className="mt-3 grid gap-2"><a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/reports/tax-summary?year=${year}&format=csv`}><span>Tax expense detail CSV</span><Download size={15} /></a><a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/reports/general-ledger?from=${from}&to=${to}&format=csv`}><span>General ledger CSV</span><Download size={15} /></a>{["customers", "jobs", "quotes", "invoices", "expenses"].map((resource) => <a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/${resource}?format=csv`} key={resource}><span className="capitalize">{resource} CSV</span><Download size={15} /></a>)}</div></section>
      </div>
    </div>
  </div>;
}
