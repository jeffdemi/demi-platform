export const financialClassificationOptions = [
  { value: "cogs", label: "Cost of goods sold (COGS)" },
  { value: "operating", label: "Operating expense" },
  { value: "labor", label: "Labor" },
  { value: "asset", label: "Asset purchase" },
  { value: "owner_distribution", label: "Owner distribution" },
] as const;

export const laborClassOptions = [
  { value: "direct", label: "Direct labor" },
  { value: "management", label: "Management labor" },
  { value: "sales", label: "Sales labor" },
] as const;

export const workerTypeOptions = [
  { value: "employee", label: "Employee" },
  { value: "owner", label: "Owner" },
  { value: "contractor", label: "Contractor" },
] as const;

export type FinancialClassification = typeof financialClassificationOptions[number]["value"];
export type LaborClass = typeof laborClassOptions[number]["value"];

export function financialClassificationLabel(value: string) {
  return financialClassificationOptions.find((option) => option.value === value)?.label
    ?? value.replaceAll("_", " ");
}

export function laborClassLabel(value: string | null | undefined) {
  if (!value) return "Not applicable";
  return laborClassOptions.find((option) => option.value === value)?.label
    ?? value.replaceAll("_", " ");
}

export const defaultFinancialSettings = {
  owner_market_salary_annual: null as number | null,
  owner_labor_class: "management" as LaborClass,
  has_non_owner_labor: false,
  reporting_basis: "cash" as "cash" | "accrual",
  target_total_ler: 2,
  minimum_profit_to_gross_margin: 0.15,
  target_profit_to_gross_margin: 0.2,
  stretch_profit_to_gross_margin: 0.25,
  core_capital_months: 2,
  minimum_roic: 0.5,
  expense_match_tolerance_percent: 2,
  expense_match_day_window: 10,
};

export function normalizeFinancialSettings(settings: {
  owner_market_salary_annual?: number | null;
  owner_labor_class?: string;
  has_non_owner_labor?: boolean;
  reporting_basis?: string;
  target_total_ler?: number;
  minimum_profit_to_gross_margin?: number;
  target_profit_to_gross_margin?: number;
  stretch_profit_to_gross_margin?: number;
  core_capital_months?: number;
  minimum_roic?: number;
  expense_match_tolerance_percent?: number;
  expense_match_day_window?: number;
} | null | undefined): typeof defaultFinancialSettings {
  const ownerLaborClass = laborClassOptions.some((option) => option.value === settings?.owner_labor_class)
    ? settings?.owner_labor_class as LaborClass
    : defaultFinancialSettings.owner_labor_class;
  const reportingBasis = settings?.reporting_basis === "accrual" ? "accrual" : "cash";
  return {
    owner_market_salary_annual: settings?.owner_market_salary_annual ?? null,
    owner_labor_class: ownerLaborClass,
    has_non_owner_labor: settings?.has_non_owner_labor ?? defaultFinancialSettings.has_non_owner_labor,
    reporting_basis: reportingBasis,
    target_total_ler: settings?.target_total_ler ?? defaultFinancialSettings.target_total_ler,
    minimum_profit_to_gross_margin: settings?.minimum_profit_to_gross_margin ?? defaultFinancialSettings.minimum_profit_to_gross_margin,
    target_profit_to_gross_margin: settings?.target_profit_to_gross_margin ?? defaultFinancialSettings.target_profit_to_gross_margin,
    stretch_profit_to_gross_margin: settings?.stretch_profit_to_gross_margin ?? defaultFinancialSettings.stretch_profit_to_gross_margin,
    core_capital_months: settings?.core_capital_months ?? defaultFinancialSettings.core_capital_months,
    minimum_roic: settings?.minimum_roic ?? defaultFinancialSettings.minimum_roic,
    expense_match_tolerance_percent: settings?.expense_match_tolerance_percent ?? defaultFinancialSettings.expense_match_tolerance_percent,
    expense_match_day_window: settings?.expense_match_day_window ?? defaultFinancialSettings.expense_match_day_window,
  };
}

type Expense = {
  amount: number;
  expense_date: string;
  financial_classification: string;
  labor_class?: string | null;
  transaction_type: string;
  voided_at?: string | null;
};

type LaborEntry = {
  worker_type: string;
  labor_class: string;
  period_end: string;
  gross_wages: number;
  employer_payroll_taxes: number;
  benefits: number;
  voided_at?: string | null;
};

type OwnerCompensation = {
  period_month: string;
  market_salary_amount: number;
  actual_wages: number;
  distributions: number;
  contributions: number;
};

type EquipmentFinance = {
  purchase_cost?: number | null;
  salvage_value?: number | null;
  in_service_date?: string | null;
  useful_life_months?: number | null;
  depreciation_method?: string | null;
};

type Snapshot = {
  cash_book_balance: number;
  cash_bank_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
  inventory: number;
  taxes_payable: number;
  credit_card_balance: number;
  short_term_debt: number;
  long_term_debt: number;
  fixed_assets_net: number;
  reconciled_at?: string | null;
};

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function signedExpense(expense: Expense) {
  if (expense.voided_at) return 0;
  return expense.transaction_type === "refund" ? -expense.amount : expense.amount;
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function monthIndex(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  return year * 12 + month - 1;
}

export function monthsInPeriod(from: string, to: string) {
  return Math.max(1, monthIndex(to) - monthIndex(from) + 1);
}

export function equipmentDepreciationForPeriod(equipment: EquipmentFinance, from: string, to: string) {
  if (
    equipment.depreciation_method !== "straight_line"
    || !equipment.in_service_date
    || !equipment.purchase_cost
    || !equipment.useful_life_months
  ) return 0;
  const depreciable = Math.max(0, equipment.purchase_cost - (equipment.salvage_value ?? 0));
  const serviceMonth = monthIndex(equipment.in_service_date);
  const finalMonth = serviceMonth + equipment.useful_life_months - 1;
  const firstIncluded = Math.max(serviceMonth, monthIndex(from));
  const lastIncluded = Math.min(finalMonth, monthIndex(to));
  if (lastIncluded < firstIncluded) return 0;
  return rounded(depreciable / equipment.useful_life_months * (lastIncluded - firstIncluded + 1));
}

export type CrabtreeReportInput = {
  from: string;
  to: string;
  settings: typeof defaultFinancialSettings;
  payments: { amount: number; payment_date: string | null; voided_at?: string | null }[];
  invoices: { amount: number; invoice_date: string; status: string }[];
  expenses: Expense[];
  laborEntries: LaborEntry[];
  ownerCompensation: OwnerCompensation[];
  equipment: EquipmentFinance[];
  snapshot?: Snapshot | null;
};

export function buildCrabtreeReport(input: CrabtreeReportInput) {
  const months = monthsInPeriod(input.from, input.to);
  const cashRevenue = input.payments
    .filter((payment) => !payment.voided_at && payment.payment_date && inRange(payment.payment_date, input.from, input.to))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const accrualRevenue = input.invoices
    .filter((invoice) => !["draft", "void"].includes(invoice.status) && inRange(invoice.invoice_date, input.from, input.to))
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const revenue = input.settings.reporting_basis === "accrual" ? accrualRevenue : cashRevenue;
  const expenses = input.expenses.filter((expense) => inRange(expense.expense_date, input.from, input.to));
  const byClass = (classification: FinancialClassification) => expenses
    .filter((expense) => expense.financial_classification === classification)
    .reduce((sum, expense) => sum + signedExpense(expense), 0);
  const cogs = byClass("cogs");
  const operatingExpenses = byClass("operating");
  const classifiedLabor = expenses.filter((expense) => expense.financial_classification === "labor");
  const labor = input.laborEntries.filter((entry) => !entry.voided_at && inRange(entry.period_end, input.from, input.to));
  const ownerPeriods = input.ownerCompensation.filter((entry) => inRange(entry.period_month, input.from.slice(0, 7) + "-01", input.to));
  const configuredMonthlyOwnerWage = (input.settings.owner_market_salary_annual ?? 0) / 12;
  const ownerMarketWage = ownerPeriods.reduce((sum, entry) => sum + entry.market_salary_amount, 0)
    + configuredMonthlyOwnerWage * Math.max(0, months - ownerPeriods.length);
  const ownerPeriodActualWages = ownerPeriods.reduce((sum, entry) => sum + entry.actual_wages, 0);
  const ownerPayrollActualWages = labor
    .filter((entry) => entry.worker_type === "owner")
    .reduce((sum, entry) => sum + entry.gross_wages, 0);
  const ownerActualWages = Math.max(ownerPeriodActualWages, ownerPayrollActualWages);
  const ownerPeriodDistributions = ownerPeriods.reduce((sum, entry) => sum + entry.distributions, 0);
  const ownerDistributions = Math.max(ownerPeriodDistributions, byClass("owner_distribution"));
  const ownerContributions = ownerPeriods.reduce((sum, entry) => sum + entry.contributions, 0);
  const wagesByClass = (laborClass: LaborClass) => {
    const payroll = labor
      .filter((entry) => entry.worker_type !== "owner" && entry.labor_class === laborClass)
      .reduce((sum, entry) => sum + entry.gross_wages, 0);
    const expenseLabor = classifiedLabor.filter((expense) => expense.labor_class === laborClass).reduce((sum, expense) => sum + signedExpense(expense), 0);
    const owner = input.settings.owner_labor_class === laborClass ? ownerMarketWage : 0;
    return payroll + expenseLabor + owner;
  };
  const directLabor = wagesByClass("direct");
  const managementLabor = wagesByClass("management");
  const salesLabor = wagesByClass("sales");
  const totalLabor = directLabor + managementLabor + salesLabor;
  const payrollBurden = labor.reduce((sum, entry) => sum + entry.employer_payroll_taxes + entry.benefits, 0);
  const depreciation = input.equipment.reduce((sum, item) => sum + equipmentDepreciationForPeriod(item, input.from, input.to), 0);
  const grossMargin = revenue - cogs;
  const contributionMargin = grossMargin - directLabor;
  const pretaxProfit = grossMargin - totalLabor - payrollBurden - operatingExpenses - depreciation;
  const totalLer = totalLabor > 0 ? grossMargin / totalLabor : null;
  const directLer = directLabor > 0 ? grossMargin / directLabor : null;
  const managementLer = managementLabor > 0 ? contributionMargin / managementLabor : null;
  const salaryCap = grossMargin > 0 ? grossMargin / input.settings.target_total_ler : 0;
  const averageMonthlyCoreCost = (totalLabor + payrollBurden + operatingExpenses) / months;
  const coreCapitalTarget = averageMonthlyCoreCost * input.settings.core_capital_months;
  const snapshot = input.snapshot;
  const investedCapital = snapshot
    ? snapshot.cash_bank_balance + snapshot.accounts_receivable + snapshot.inventory + snapshot.fixed_assets_net
      - snapshot.accounts_payable - snapshot.taxes_payable - snapshot.credit_card_balance
      - snapshot.short_term_debt - snapshot.long_term_debt
    : null;
  const annualizedProfit = pretaxProfit / months * 12;
  const roic = investedCapital && investedCapital > 0 ? annualizedProfit / investedCapital : null;
  return {
    months,
    revenue: rounded(revenue),
    cashRevenue: rounded(cashRevenue),
    accrualRevenue: rounded(accrualRevenue),
    cogs: rounded(cogs),
    grossMargin: rounded(grossMargin),
    directLabor: rounded(directLabor),
    managementLabor: rounded(managementLabor),
    salesLabor: rounded(salesLabor),
    totalLabor: rounded(totalLabor),
    payrollBurden: rounded(payrollBurden),
    contributionMargin: rounded(contributionMargin),
    operatingExpenses: rounded(operatingExpenses),
    depreciation: rounded(depreciation),
    pretaxProfit: rounded(pretaxProfit),
    profitToGrossMargin: grossMargin ? pretaxProfit / grossMargin : null,
    totalLer,
    directLer,
    managementLer,
    salaryCap: rounded(salaryCap),
    salaryHeadroom: rounded(salaryCap - totalLabor),
    ownerMarketWage: rounded(ownerMarketWage),
    ownerActualWages: rounded(ownerActualWages),
    ownerDistributions: rounded(ownerDistributions),
    ownerContributions: rounded(ownerContributions),
    coreCapitalTarget: rounded(coreCapitalTarget),
    coreCapitalActual: snapshot?.cash_bank_balance ?? null,
    coreCapitalSurplus: snapshot ? rounded(snapshot.cash_bank_balance - coreCapitalTarget) : null,
    investedCapital: investedCapital === null ? null : rounded(investedCapital),
    roic,
  };
}

export type MonthEndChecklistInput = {
  settingsConfigured: boolean;
  ownerCompensationRecorded: boolean;
  hasNonOwnerLabor: boolean;
  laborRecorded: boolean;
  unreviewedExpenseClassifications: number;
  unreviewedBankTransactions: number;
  unreconciledBankAccounts?: number;
  snapshot?: Snapshot | null;
  expectedAccountsReceivable: number;
  incompleteEquipmentSchedules: number;
};

export function buildMonthEndChecklist(input: MonthEndChecklistInput) {
  const cashDifference = input.snapshot
    ? rounded(input.snapshot.cash_bank_balance - input.snapshot.cash_book_balance)
    : null;
  const receivableDifference = input.snapshot
    ? rounded(input.snapshot.accounts_receivable - input.expectedAccountsReceivable)
    : null;
  return [
    { key: "settings", label: "Owner market compensation and targets configured", complete: input.settingsConfigured, href: "/reports/settings" },
    { key: "owner_comp", label: "Owner compensation recorded for the month", complete: input.ownerCompensationRecorded, href: "/reports/settings" },
    { key: "labor", label: "Labor and payroll recorded", complete: !input.hasNonOwnerLabor || input.laborRecorded, href: "/labor" },
    { key: "classifications", label: "Expense classifications reviewed", complete: input.unreviewedExpenseClassifications === 0, detail: `${input.unreviewedExpenseClassifications} remaining`, href: "/expenses?classificationReview=missing" },
    { key: "bank", label: "Imported bank transactions reviewed", complete: input.unreviewedBankTransactions === 0, detail: `${input.unreviewedBankTransactions} remaining`, href: "/finance?status=unreviewed" },
    { key: "statements", label: "Every active bank and credit account reconciled", complete: (input.unreconciledBankAccounts ?? 0) === 0, detail: `${input.unreconciledBankAccounts ?? 0} remaining`, href: "/finance/reconciliations/new" },
    { key: "balance", label: "Month-end balances entered", complete: Boolean(input.snapshot), href: "/finance/month-end" },
    { key: "cash", label: "Book cash reconciles to bank cash", complete: cashDifference === 0 && Boolean(input.snapshot?.reconciled_at), detail: cashDifference === null ? "Balance not entered" : `${cashDifference.toFixed(2)} difference`, href: "/finance/month-end" },
    { key: "receivables", label: "Accounts receivable agrees with unpaid invoices", complete: receivableDifference === 0, detail: receivableDifference === null ? "Balance not entered" : `${receivableDifference.toFixed(2)} difference`, href: "/finance/month-end" },
    { key: "equipment", label: "Equipment depreciation schedules are complete", complete: input.incompleteEquipmentSchedules === 0, detail: `${input.incompleteEquipmentSchedules} remaining`, href: "/equipment" },
  ];
}
