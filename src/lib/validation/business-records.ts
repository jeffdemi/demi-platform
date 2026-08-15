import { z } from "zod";

const optionalText = (maximum = 5000) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().max(maximum).optional(),
);
const requiredText = (label: string, maximum = 5000) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.string().min(1, `${label} is required.`).max(maximum),
);
const date = (label: string, required = false) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`).refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, `${label} must be a valid date.`)[required ? "nonoptional" : "optional"](),
);
const number = (label: string, required = false) => z.preprocess(
  (value) => typeof value === "string" ? value.trim().replaceAll("$", "").replaceAll(",", "") || undefined : value,
  z.coerce.number().finite(`${label} must be a valid number.`).nonnegative(`${label} cannot be negative.`)[required ? "nonoptional" : "optional"](),
);
const signedNumber = (label: string, required = false) => z.preprocess(
  (value) => typeof value === "string" ? value.trim().replaceAll("$", "").replaceAll(",", "") || undefined : value,
  z.coerce.number().finite(`${label} must be a valid number.`)[required ? "nonoptional" : "optional"](),
);
const positiveId = (label: string, required = true) => z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().positive(`Select ${label}.`)[required ? "nonoptional" : "optional"](),
);
const optionalLaborClass = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.enum(["direct", "management", "sales"]).optional(),
);

export const quoteFormSchema = z.object({
  customerId: positiveId("a customer"),
  status: z.enum(["draft", "sent", "accepted", "declined", "no_response", "expired", "converted"]),
  quoteDate: date("Quote date", true), expirationDate: date("Expiration date"),
  sentDate: date("Sent date"), responseDate: date("Response date"),
  contactMethod: optionalText(50), referralSource: optionalText(250), serviceAddress: optionalText(500),
  municipality: optionalText(160), propertyLocation: optionalText(100), locationDescription: optionalText(),
  hazardNotes: optionalText(), customerScope: optionalText(), internalNotes: optionalText(),
  normalPrice: number("Normal price"), quotedPrice: number("Quoted price"), discountReason: optionalText(500),
  proBono: z.boolean(), acceptedMethod: optionalText(50), acceptanceNotes: optionalText(), pa811Required: z.boolean(),
}).superRefine((value, context) => {
  if (value.status === "converted") context.addIssue({ code: "custom", path: ["status"], message: "Use Convert to Job to mark a quote converted." });
});

export const quoteStatusSchema = z.object({
  status: z.enum(["sent", "accepted", "declined", "no_response", "expired"]),
  acceptedMethod: optionalText(50),
});

export const invoiceFormSchema = z.object({
  customerId: positiveId("a customer"), jobId: positiveId("a job", false), amount: number("Amount", true),
  invoiceDate: date("Invoice date", true), dueDate: date("Due date"), paymentTerms: optionalText(250),
  status: z.enum(["draft", "unpaid", "paid", "void"]), paidDate: date("Paid date"), notes: optionalText(),
}).superRefine((value, context) => {
  if (value.status === "paid" && !value.paidDate) context.addIssue({ code: "custom", path: ["paidDate"], message: "Paid date is required for a paid invoice." });
});

export const expenseFormSchema = z.object({
  expenseDate: date("Expense date", true), category: requiredText("Category", 100), vendor: optionalText(250),
  description: optionalText(1000), amount: number("Amount", true), paymentMethod: optionalText(100),
  jobId: positiveId("a job", false), equipmentId: positiveId("equipment", false), notes: optionalText(),
  transactionType: z.enum(["expense", "asset", "refund"]),
  refundOfExpenseId: positiveId("an expense to refund", false),
  bankTransactionId: positiveId("a bank transaction", false),
  taxCategory: optionalText(150),
  deductiblePercent: number("Deductible percentage").default(100),
  financialClassification: z.enum(["cogs", "operating", "labor", "asset", "owner_distribution"]).default("operating"),
  laborClass: optionalLaborClass,
}).superRefine((value, context) => {
  if (value.transactionType === "refund" && !value.refundOfExpenseId) {
    context.addIssue({ code: "custom", path: ["refundOfExpenseId"], message: "Select the original expense for this refund." });
  }
  if (value.transactionType !== "refund" && value.refundOfExpenseId) {
    context.addIssue({ code: "custom", path: ["refundOfExpenseId"], message: "Only refunds can reference an original expense." });
  }
  if ((value.deductiblePercent ?? 0) > 100) {
    context.addIssue({ code: "custom", path: ["deductiblePercent"], message: "Deductible percentage cannot exceed 100." });
  }
  if (value.financialClassification === "labor" && !value.laborClass) {
    context.addIssue({ code: "custom", path: ["laborClass"], message: "Select a labor classification." });
  }
  if (value.financialClassification !== "labor" && value.laborClass) {
    context.addIssue({ code: "custom", path: ["laborClass"], message: "Labor class is only used for labor records." });
  }
  if (value.transactionType === "asset" && value.financialClassification !== "asset") {
    context.addIssue({ code: "custom", path: ["financialClassification"], message: "Asset purchases must use the asset classification." });
  }
  if (value.transactionType !== "asset" && value.transactionType !== "refund" && value.financialClassification === "asset") {
    context.addIssue({ code: "custom", path: ["transactionType"], message: "Use the asset purchase record type for asset classifications." });
  }
  if (value.financialClassification === "owner_distribution" && (value.deductiblePercent ?? 0) !== 0) {
    context.addIssue({ code: "custom", path: ["deductiblePercent"], message: "Owner distributions are not deductible business expenses." });
  }
});

export const bulkExpenseClassificationSchema = z.object({
  expenseIds: z.array(z.coerce.number().int().positive()).min(1, "Select at least one expense.").max(1000),
  financialClassification: z.enum(["cogs", "operating", "labor", "asset", "owner_distribution"]),
  laborClass: optionalLaborClass,
}).superRefine((value, context) => {
  if (value.financialClassification === "labor" && !value.laborClass) {
    context.addIssue({ code: "custom", path: ["laborClass"], message: "Select a labor classification." });
  }
  if (value.financialClassification !== "labor" && value.laborClass) {
    context.addIssue({ code: "custom", path: ["laborClass"], message: "Labor class is only used for labor records." });
  }
});

export const bankAccountSchema = z.object({
  name: requiredText("Account name", 150),
  institution: optionalText(150),
  accountType: z.enum(["checking", "savings", "credit_card", "cash", "other"]),
  lastFour: z.preprocess((value) => typeof value === "string" ? value.trim() || undefined : value, z.string().regex(/^\d{4}$/, "Last four must contain exactly four digits.").optional()),
});

export const excludeBankTransactionSchema = z.object({
  reason: requiredText("Reason", 500),
});

export const bankStatementPeriodSchema = z.object({
  accountId: positiveId("a bank account"),
  statementStart: date("Statement start", true),
  statementEnd: date("Statement end", true),
  openingBalance: signedNumber("Opening balance", true),
  closingBalance: signedNumber("Closing balance", true),
  notes: optionalText(1000),
}).superRefine((value, context) => {
  if (value.statementStart && value.statementEnd && value.statementEnd < value.statementStart) {
    context.addIssue({ code: "custom", path: ["statementEnd"], message: "Statement end cannot be before statement start." });
  }
});

export const bankTransactionAllocationSchema = z.object({
  ledgerAccountId: positiveId("a ledger account"),
  amount: number("Allocation amount", true),
  memo: requiredText("Memo", 500),
  taxCategory: optionalText(150),
  deductiblePercent: number("Deductible percentage").default(100),
}).superRefine((value, context) => {
  if ((value.deductiblePercent ?? 0) > 100) {
    context.addIssue({ code: "custom", path: ["deductiblePercent"], message: "Deductible percentage cannot exceed 100." });
  }
});

export const bankTransferSchema = z.object({
  otherTransactionId: positiveId("the matching transfer transaction"),
  memo: optionalText(500),
});

export const existingExpenseMatchSchema = z.object({
  expenseId: positiveId("an existing expense"),
});

export const bookkeepingAdjustmentSchema = z.object({
  entryDate: date("Entry date", true),
  description: requiredText("Description", 500),
  debitAccountId: positiveId("a debit account"),
  creditAccountId: positiveId("a credit account"),
  amount: number("Amount", true),
  reason: requiredText("Reason", 1000),
}).superRefine((value, context) => {
  if (value.debitAccountId && value.debitAccountId === value.creditAccountId) {
    context.addIssue({ code: "custom", path: ["creditAccountId"], message: "Debit and credit accounts must differ." });
  }
});

export const reopenAccountingMonthSchema = z.object({ reason: requiredText("Reason", 500) });

export const digitalAssetAccountSchema = z.object({
  name: requiredText("Account name", 150),
  provider: optionalText(150),
  accountType: z.enum(["exchange", "wallet", "custodian", "other"]),
  externalReference: optionalText(250),
});

export const digitalAssetImportSchema = z.object({ accountId: positiveId("a digital asset account") });
export const digitalAssetReconciliationSchema = z.object({
  accountId: positiveId("a digital asset account"), asOfDate: date("As-of date", true),
  balances: requiredText("Reported balances", 2000), reportedCashUsd: signedNumber("Reported cash").default(0), notes: optionalText(2000),
});

export const businessLineAssignmentSchema = z.object({
  recordType: z.enum(["job", "invoice", "expense", "equipment", "labor", "payment", "journal_entry"]),
  recordId: positiveId("a record"),
  businessLineId: positiveId("a business line"),
});

export const capitalTransactionSchema = z.object({
  businessLineId: positiveId("a business line", false),
  bankAccountId: positiveId("a bank account", false),
  transactionDate: date("Transaction date", true),
  transactionType: z.enum(["owner_contribution", "owner_loan", "loan_repayment", "owner_draw", "estimated_tax"]),
  amount: number("Amount", true),
  counterparty: optionalText(250),
  memo: requiredText("Memo", 1000),
});

export const businessIdentitySchema = z.object({
  legalName: requiredText("Legal name", 250),
  publicBrand: requiredText("Public brand", 250),
  taxTreatment: z.enum(["single_member_disregarded", "s_corporation", "c_corporation", "partnership", "other"]),
  fictitiousNameStatus: z.enum(["not_required", "needs_review", "planned", "filed"]),
  fictitiousNameJurisdiction: optionalText(150),
  notes: optionalText(2000),
});

export const cleanupItemSchema = z.object({
  businessLineId: positiveId("a business line", false),
  itemType: z.enum(["opening_balance", "owner_advance", "venmo_history", "uncategorized", "other"]),
  effectiveDate: date("Effective date", true),
  description: requiredText("Description", 1000),
  amount: signedNumber("Amount"),
  debitAccountId: positiveId("a debit account", false),
  creditAccountId: positiveId("a credit account", false),
  resolutionNotes: optionalText(2000),
}).superRefine((value, context) => {
  if (value.debitAccountId && value.debitAccountId === value.creditAccountId) {
    context.addIssue({ code: "custom", path: ["creditAccountId"], message: "Debit and credit accounts must differ." });
  }
});

export const paymentFormSchema = z.object({
  invoiceId: positiveId("an invoice", false),
  jobId: positiveId("a job", false),
  bankTransactionId: positiveId("a bank transaction", false),
  paymentDate: date("Payment date", true),
  amount: number("Amount", true),
  method: optionalText(100),
  reference: optionalText(250),
  notes: optionalText(1000),
}).superRefine((value, context) => {
  if (!value.invoiceId && !value.jobId) context.addIssue({ code: "custom", path: ["invoiceId"], message: "Select an invoice or job." });
  if ((value.amount ?? 0) <= 0) context.addIssue({ code: "custom", path: ["amount"], message: "Amount must be greater than zero." });
});

export const voidExpenseSchema = z.object({
  reason: requiredText("Reason", 500),
  confirm: z.literal("yes", { message: "Confirm that you want to archive this record." }),
});

export const recordRemovalSchema = z.object({
  intent: z.enum(["archive", "restore", "delete"]),
  reason: optionalText(500),
  confirm: z.string().optional(),
}).superRefine((value, context) => {
  if (["archive", "delete"].includes(value.intent) && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Enter a removal reason." });
  }
  if (["archive", "delete"].includes(value.intent) && value.confirm !== "yes") {
    context.addIssue({ code: "custom", path: ["confirm"], message: "Confirm the removal." });
  }
});

export const equipmentFormSchema = z.object({
  name: requiredText("Equipment name", 250), equipmentType: optionalText(100), makeModel: optionalText(250),
  serialNumber: optionalText(250), hourMeter: number("Hour meter"), active: z.boolean(), notes: optionalText(),
});

export const equipmentFinancialsSchema = z.object({
  purchaseDate: date("Purchase date"),
  inServiceDate: date("In-service date"),
  purchaseCost: number("Purchase cost"),
  salvageValue: number("Salvage value").default(0),
  usefulLifeMonths: number("Useful life").refine(
    (value) => value === undefined || Number.isInteger(value),
    "Useful life must be a whole number of months.",
  ),
  depreciationMethod: z.enum(["straight_line"]).optional(),
  loanLender: optionalText(250),
  loanOriginalAmount: number("Original loan amount"),
  loanBalance: number("Loan balance"),
  loanInterestRate: number("Interest rate"),
  loanMaturityDate: date("Loan maturity date"),
}).superRefine((value, context) => {
  if ((value.salvageValue ?? 0) > (value.purchaseCost ?? 0) && value.purchaseCost !== undefined) {
    context.addIssue({ code: "custom", path: ["salvageValue"], message: "Salvage value cannot exceed purchase cost." });
  }
  const depreciationValues = [value.inServiceDate, value.purchaseCost, value.usefulLifeMonths, value.depreciationMethod];
  if (depreciationValues.some(Boolean) && !depreciationValues.every(Boolean)) {
    context.addIssue({ code: "custom", path: ["depreciationMethod"], message: "In-service date, purchase cost, useful life, and method are all required for depreciation." });
  }
  if ((value.loanInterestRate ?? 0) > 100) {
    context.addIssue({ code: "custom", path: ["loanInterestRate"], message: "Interest rate cannot exceed 100%." });
  }
});

export const laborEntrySchema = z.object({
  workerName: requiredText("Worker name", 250),
  workerType: z.enum(["employee", "owner", "contractor"]),
  laborClass: z.enum(["direct", "management", "sales"]),
  periodStart: date("Period start", true),
  periodEnd: date("Period end", true),
  paidDate: date("Paid date"),
  regularHours: number("Regular hours").default(0),
  overtimeHours: number("Overtime hours").default(0),
  grossWages: number("Gross wages").default(0),
  employerPayrollTaxes: number("Employer payroll taxes").default(0),
  benefits: number("Benefits").default(0),
  jobId: positiveId("a job", false),
  notes: optionalText(1000),
}).superRefine((value, context) => {
  if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "Period end cannot be before period start." });
  }
  if ((value.grossWages ?? 0) + (value.employerPayrollTaxes ?? 0) + (value.benefits ?? 0) <= 0) {
    context.addIssue({ code: "custom", path: ["grossWages"], message: "Enter wages, payroll taxes, or benefits." });
  }
});

export const voidLaborEntrySchema = z.object({ reason: requiredText("Reason", 500) });

export const financialSettingsSchema = z.object({
  ownerMarketSalaryAnnual: number("Owner market salary"),
  ownerLaborClass: z.enum(["direct", "management", "sales"]),
  hasNonOwnerLabor: z.boolean(),
  reportingBasis: z.enum(["cash", "accrual"]),
  targetTotalLer: number("Target total LER", true),
  minimumProfitPercent: number("Minimum profit target", true),
  targetProfitPercent: number("Profit target", true),
  stretchProfitPercent: number("Stretch profit target", true),
  coreCapitalMonths: number("Core capital months", true),
  minimumRoicPercent: number("Minimum ROIC", true),
}).superRefine((value, context) => {
  if ((value.targetTotalLer ?? 0) <= 0) context.addIssue({ code: "custom", path: ["targetTotalLer"], message: "Target LER must be greater than zero." });
  if ((value.coreCapitalMonths ?? 0) <= 0) context.addIssue({ code: "custom", path: ["coreCapitalMonths"], message: "Core capital months must be greater than zero." });
  for (const [key, amount] of [["minimumProfitPercent", value.minimumProfitPercent], ["targetProfitPercent", value.targetProfitPercent], ["stretchProfitPercent", value.stretchProfitPercent]] as const) {
    if ((amount ?? 0) > 100) context.addIssue({ code: "custom", path: [key], message: "Profit targets cannot exceed 100%." });
  }
  if ((value.minimumProfitPercent ?? 0) > (value.targetProfitPercent ?? 0) || (value.targetProfitPercent ?? 0) > (value.stretchProfitPercent ?? 0)) {
    context.addIssue({ code: "custom", path: ["targetProfitPercent"], message: "Profit targets must increase from minimum to target to stretch." });
  }
});

export const ownerCompensationSchema = z.object({
  periodMonth: date("Month", true),
  marketSalaryAmount: number("Market salary amount").default(0),
  actualWages: number("Actual wages").default(0),
  distributions: number("Distributions").default(0),
  contributions: number("Contributions").default(0),
  notes: optionalText(1000),
});

export const monthlyFinancialSnapshotSchema = z.object({
  periodMonth: date("Month", true),
  cashBookBalance: signedNumber("Book cash", true),
  cashBankBalance: signedNumber("Bank cash", true),
  accountsReceivable: number("Accounts receivable").default(0),
  accountsPayable: number("Accounts payable").default(0),
  inventory: number("Inventory").default(0),
  taxesPayable: number("Taxes payable").default(0),
  creditCardBalance: number("Credit card balance").default(0),
  shortTermDebt: number("Short-term debt").default(0),
  longTermDebt: number("Long-term debt").default(0),
  fixedAssetsNet: number("Net fixed assets").default(0),
  notes: optionalText(1000),
  reconcile: z.boolean(),
}).superRefine((value, context) => {
  if (value.reconcile && Math.abs((value.cashBankBalance ?? 0) - (value.cashBookBalance ?? 0)) > 0.01) {
    context.addIssue({ code: "custom", path: ["cashBankBalance"], message: "Book cash and bank cash must agree before reconciliation." });
  }
});

export const maintenanceFormSchema = z.object({
  equipmentId: positiveId("equipment"), serviceDate: date("Service date", true), serviceType: requiredText("Service type", 250),
  hourMeter: number("Hour meter"), cost: number("Cost"), nextDueDate: date("Next due date"),
  nextDueHours: number("Next due hours"), notes: optionalText(),
});

export function formValues(formData: FormData, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, formData.get(name)]));
}
