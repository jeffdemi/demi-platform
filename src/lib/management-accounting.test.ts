import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildCrabtreeReport,
  buildMonthEndChecklist,
  defaultFinancialSettings,
  equipmentDepreciationForPeriod,
  normalizeFinancialSettings,
} from "./domain/management-accounting";
import {
  bulkExpenseClassificationSchema,
  equipmentFinancialsSchema,
  expenseFormSchema,
  financialSettingsSchema,
  laborEntrySchema,
  monthlyFinancialSnapshotSchema,
} from "./validation/business-records";

describe("Crabtree-inspired management reporting", () => {
  it("normalizes owner labor, classifies costs, and calculates the scorecard", () => {
    const report = buildCrabtreeReport({
      from: "2026-01-01",
      to: "2026-03-31",
      settings: { ...defaultFinancialSettings, owner_market_salary_annual: 60_000 },
      payments: [{ amount: 100_000, payment_date: "2026-02-15", voided_at: null }],
      invoices: [{ amount: 120_000, invoice_date: "2026-02-01", status: "unpaid" }],
      expenses: [
        { amount: 20_000, expense_date: "2026-01-10", financial_classification: "cogs", transaction_type: "expense" },
        { amount: 10_000, expense_date: "2026-02-10", financial_classification: "operating", transaction_type: "expense" },
        { amount: 5_000, expense_date: "2026-02-20", financial_classification: "labor", labor_class: "direct", transaction_type: "expense" },
        { amount: 2_000, expense_date: "2026-03-01", financial_classification: "owner_distribution", transaction_type: "expense" },
      ],
      laborEntries: [
        { worker_type: "employee", labor_class: "direct", period_end: "2026-03-01", gross_wages: 20_000, employer_payroll_taxes: 2_000, benefits: 1_000 },
        { worker_type: "employee", labor_class: "management", period_end: "2026-03-01", gross_wages: 6_000, employer_payroll_taxes: 0, benefits: 0 },
      ],
      ownerCompensation: [],
      equipment: [{ purchase_cost: 12_000, salvage_value: 0, in_service_date: "2026-01-01", useful_life_months: 12, depreciation_method: "straight_line" }],
      snapshot: {
        cash_book_balance: 50_000,
        cash_bank_balance: 50_000,
        accounts_receivable: 5_000,
        accounts_payable: 2_000,
        inventory: 0,
        taxes_payable: 0,
        credit_card_balance: 0,
        short_term_debt: 0,
        long_term_debt: 10_000,
        fixed_assets_net: 20_000,
        reconciled_at: "2026-04-01T00:00:00Z",
      },
    });

    expect(report).toMatchObject({
      revenue: 100_000,
      cogs: 20_000,
      grossMargin: 80_000,
      directLabor: 25_000,
      managementLabor: 21_000,
      totalLabor: 46_000,
      payrollBurden: 3_000,
      depreciation: 3_000,
      pretaxProfit: 18_000,
      ownerMarketWage: 15_000,
      ownerDistributions: 2_000,
      salaryCap: 40_000,
      salaryHeadroom: -6_000,
      investedCapital: 63_000,
    });
    expect(report.profitToGrossMargin).toBeCloseTo(0.225);
    expect(report.totalLer).toBeCloseTo(80_000 / 46_000);
    expect(report.roic).toBeCloseTo(72_000 / 63_000);
  });

  it("switches revenue basis without changing source records", () => {
    const base = {
      from: "2026-01-01",
      to: "2026-01-31",
      payments: [{ amount: 500, payment_date: "2026-01-10" }],
      invoices: [{ amount: 800, invoice_date: "2026-01-05", status: "unpaid" }],
      expenses: [],
      laborEntries: [],
      ownerCompensation: [],
      equipment: [],
      snapshot: null,
    };
    expect(buildCrabtreeReport({ ...base, settings: defaultFinancialSettings }).revenue).toBe(500);
    expect(buildCrabtreeReport({ ...base, settings: { ...defaultFinancialSettings, reporting_basis: "accrual" } }).revenue).toBe(800);
  });

  it("replaces actual owner payroll with market compensation in operating labor", () => {
    const report = buildCrabtreeReport({
      from: "2026-01-01",
      to: "2026-01-31",
      settings: { ...defaultFinancialSettings, owner_market_salary_annual: 60_000, owner_labor_class: "direct" },
      payments: [{ amount: 20_000, payment_date: "2026-01-31" }],
      invoices: [],
      expenses: [],
      laborEntries: [{ worker_type: "owner", labor_class: "direct", period_end: "2026-01-31", gross_wages: 3_000, employer_payroll_taxes: 250, benefits: 0 }],
      ownerCompensation: [],
      equipment: [],
      snapshot: null,
    });
    expect(report.directLabor).toBe(5_000);
    expect(report.ownerMarketWage).toBe(5_000);
    expect(report.ownerActualWages).toBe(3_000);
    expect(report.payrollBurden).toBe(250);
  });

  it("fills missing owner months from settings and does not double-count distributions", () => {
    const report = buildCrabtreeReport({
      from: "2026-01-01",
      to: "2026-03-31",
      settings: { ...defaultFinancialSettings, owner_market_salary_annual: 60_000 },
      payments: [],
      invoices: [],
      expenses: [{ amount: 2_000, expense_date: "2026-01-15", financial_classification: "owner_distribution", transaction_type: "expense" }],
      laborEntries: [],
      ownerCompensation: [{ period_month: "2026-01-01", market_salary_amount: 4_500, actual_wages: 3_000, distributions: 2_000, contributions: 0 }],
      equipment: [],
      snapshot: null,
    });
    expect(report.ownerMarketWage).toBe(14_500);
    expect(report.ownerActualWages).toBe(3_000);
    expect(report.ownerDistributions).toBe(2_000);
  });

  it("limits straight-line depreciation to the in-service useful life", () => {
    const equipment = { purchase_cost: 13_000, salvage_value: 1_000, in_service_date: "2026-02-15", useful_life_months: 12, depreciation_method: "straight_line" };
    expect(equipmentDepreciationForPeriod(equipment, "2026-01-01", "2026-03-31")).toBe(2_000);
    expect(equipmentDepreciationForPeriod(equipment, "2027-02-01", "2027-12-31")).toBe(0);
  });

  it("identifies missing month-end information and reconciliation differences", () => {
    const checklist = buildMonthEndChecklist({
      settingsConfigured: true,
      ownerCompensationRecorded: false,
      hasNonOwnerLabor: true,
      laborRecorded: false,
      unreviewedExpenseClassifications: 3,
      unreviewedBankTransactions: 2,
      snapshot: {
        cash_book_balance: 1_000,
        cash_bank_balance: 950,
        accounts_receivable: 400,
        accounts_payable: 0,
        inventory: 0,
        taxes_payable: 0,
        credit_card_balance: 0,
        short_term_debt: 0,
        long_term_debt: 0,
        fixed_assets_net: 0,
        reconciled_at: null,
      },
      expectedAccountsReceivable: 500,
      incompleteEquipmentSchedules: 1,
    });
    expect(checklist.find((item) => item.key === "settings")?.complete).toBe(true);
    expect(checklist.find((item) => item.key === "owner_comp")?.complete).toBe(false);
    expect(checklist.find((item) => item.key === "cash")).toMatchObject({ complete: false, detail: "-50.00 difference" });
    expect(checklist.find((item) => item.key === "receivables")).toMatchObject({ complete: false, detail: "-100.00 difference" });
    expect(checklist.filter((item) => !item.complete)).toHaveLength(7);
  });

  it("uses safe defaults for unrecognized stored settings", () => {
    const settings = normalizeFinancialSettings({ owner_labor_class: "legacy", reporting_basis: "legacy", target_total_ler: 2.5 });
    expect(settings.owner_labor_class).toBe("management");
    expect(settings.reporting_basis).toBe("cash");
    expect(settings.target_total_ler).toBe(2.5);
  });
});

describe("management accounting validation and schema", () => {
  it("enforces financial and labor classifications", () => {
    const base = { expenseDate: "2026-08-01", category: "Payroll", amount: "100", transactionType: "expense" };
    expect(expenseFormSchema.safeParse({ ...base, financialClassification: "labor", laborClass: "direct" }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...base, financialClassification: "labor" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, financialClassification: "owner_distribution", deductiblePercent: "100" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, transactionType: "asset", financialClassification: "operating" }).success).toBe(false);
  });

  it("validates bulk expense classifications and selected row ids", () => {
    expect(bulkExpenseClassificationSchema.safeParse({ expenseIds: ["1", "2"], financialClassification: "operating" }).success).toBe(true);
    expect(bulkExpenseClassificationSchema.safeParse({ expenseIds: [], financialClassification: "operating" }).success).toBe(false);
    expect(bulkExpenseClassificationSchema.safeParse({ expenseIds: ["1"], financialClassification: "labor" }).success).toBe(false);
    expect(bulkExpenseClassificationSchema.safeParse({ expenseIds: ["1"], financialClassification: "labor", laborClass: "direct" }).success).toBe(true);
  });

  it("validates payroll, targets, balances, and equipment schedules", () => {
    expect(laborEntrySchema.safeParse({ workerName: "Jeff", workerType: "owner", laborClass: "direct", periodStart: "2026-08-01", periodEnd: "2026-08-07", grossWages: "500" }).success).toBe(true);
    expect(laborEntrySchema.safeParse({ workerName: "Jeff", workerType: "owner", laborClass: "direct", periodStart: "2026-08-08", periodEnd: "2026-08-07", grossWages: "500" }).success).toBe(false);
    expect(financialSettingsSchema.safeParse({ ownerLaborClass: "management", reportingBasis: "cash", hasNonOwnerLabor: false, targetTotalLer: "2", minimumProfitPercent: "15", targetProfitPercent: "20", stretchProfitPercent: "25", coreCapitalMonths: "2", minimumRoicPercent: "50" }).success).toBe(true);
    expect(monthlyFinancialSnapshotSchema.safeParse({ periodMonth: "2026-08-01", cashBookBalance: "100", cashBankBalance: "90", reconcile: true }).success).toBe(false);
    expect(equipmentFinancialsSchema.safeParse({ inServiceDate: "2026-01-01", purchaseCost: "12000", usefulLifeMonths: "12", depreciationMethod: "straight_line" }).success).toBe(true);
    expect(equipmentFinancialsSchema.safeParse({ inServiceDate: "2026-01-01", purchaseCost: "12000", usefulLifeMonths: "12.5", depreciationMethod: "straight_line" }).success).toBe(false);
  });

  it("uses an additive, admin-scoped migration without deleting business data", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260809205108_crabtree_management_reporting.sql", import.meta.url), "utf8");
    expect(migration).toContain("add column financial_classification");
    expect(migration).toContain("create table public.labor_entries");
    expect(migration).toContain("create table public.owner_compensation_periods");
    expect(migration).toContain("create table public.monthly_financial_snapshots");
    expect(migration).toContain("private.is_business_admin");
    expect(migration).toContain("financial_classification_reviewed = source.financial_classification_reviewed");
    expect(migration).not.toMatch(/drop\s+table|truncate|delete\s+from/i);
  });
});
