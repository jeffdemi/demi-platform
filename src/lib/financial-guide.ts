export const financialGuideCategories = [
  "Setup & ownership",
  "Expenses & labor",
  "Month end & equipment",
  "Reports & metrics",
] as const;

export type FinancialGuideCategory = typeof financialGuideCategories[number];

export type FinancialGuideTerm = {
  id: string;
  term: string;
  category: FinancialGuideCategory;
  definition: string;
  formula?: string;
  source?: string;
  action?: string;
};

export const financialGuideTerms: FinancialGuideTerm[] = [
  {
    id: "reporting-basis",
    term: "Management reporting basis",
    category: "Setup & ownership",
    definition: "Controls when revenue appears in the normalized management report. Cash basis uses collected payments; accrual basis uses eligible invoices.",
    source: "Targets & Owner Pay settings.",
    action: "Use one basis consistently when comparing periods.",
  },
  {
    id: "owner-market-salary",
    term: "Owner market salary",
    category: "Setup & ownership",
    definition: "Reasonable annual compensation for the work the owner performs, independent of the cash actually withdrawn from the business.",
    source: "Annual setting, allocated monthly unless a month-specific amount is entered.",
    action: "Use a defensible market rate so profit is not inflated by underpaying the owner.",
  },
  {
    id: "owner-labor-class",
    term: "Owner labor class",
    category: "Setup & ownership",
    definition: "Places normalized owner compensation in direct, management, or sales labor according to the owner work being performed.",
  },
  {
    id: "market-salary-month",
    term: "Market-rate salary for month",
    category: "Setup & ownership",
    definition: "The owner market compensation used for one reporting month. It normally starts at one-twelfth of the annual owner market salary.",
  },
  {
    id: "actual-owner-wages",
    term: "Actual owner wages",
    category: "Setup & ownership",
    definition: "Payroll actually paid to the owner. It is shown for comparison but replaced by market-rate owner compensation in normalized operating profit.",
    source: "Owner compensation or owner payroll entries. The app avoids counting the same wages twice.",
  },
  {
    id: "owner-distributions",
    term: "Owner distributions",
    category: "Setup & ownership",
    definition: "Cash or property withdrawn as a return on ownership rather than pay for work.",
    action: "Keep distributions separate from wages and operating expenses.",
  },
  {
    id: "owner-contributions",
    term: "Owner contributions",
    category: "Setup & ownership",
    definition: "Personal money or property invested by the owner into the business.",
  },
  {
    id: "normalized-owner-compensation",
    term: "Normalized owner compensation",
    category: "Setup & ownership",
    definition: "The market-rate owner wage used in management reporting instead of whatever amount happened to be paid during the period.",
    action: "Use it to compare performance as though the business paid a fair wage for every job performed.",
  },
  {
    id: "cogs",
    term: "Cost of goods sold (COGS)",
    category: "Expenses & labor",
    definition: "Non-labor costs directly required to deliver customer work, such as disposal, job-specific materials, or production subcontracting.",
    action: "Classify only costs that rise or fall directly with completed work.",
  },
  {
    id: "operating-expense",
    term: "Operating expense",
    category: "Expenses & labor",
    definition: "Overhead required to run the company but not directly tied to one job, such as insurance, advertising, office costs, or general repairs.",
  },
  {
    id: "labor-expense",
    term: "Labor financial classification",
    category: "Expenses & labor",
    definition: "A labor cost not already represented by a payroll entry, such as separately tracked production subcontracting.",
    action: "Do not enter the same payroll cost in both Expenses and Labor.",
  },
  {
    id: "asset-purchase",
    term: "Asset purchase",
    category: "Expenses & labor",
    definition: "Equipment or another long-lived business resource. It affects cash immediately but is excluded from operating expense in the normalized P&L.",
  },
  {
    id: "management-classification",
    term: "Management classification",
    category: "Expenses & labor",
    definition: "Assigns each financial outflow to COGS, operating, labor, asset, or owner distribution for management reporting.",
  },
  {
    id: "classification-reviewed",
    term: "Classification reviewed",
    category: "Expenses & labor",
    definition: "Confirms that a person inspected and approved the management classification rather than relying on an imported default.",
  },
  {
    id: "tax-category",
    term: "Tax category",
    category: "Expenses & labor",
    definition: "The category used for tax-preparation exports. It is separate from the management classification used to operate the business.",
  },
  {
    id: "deductible-percent",
    term: "Business deductible percent",
    category: "Expenses & labor",
    definition: "The estimated business-deductible portion of an expense for tax preparation.",
    action: "Confirm final deductibility with your accountant.",
  },
  {
    id: "refund-credit",
    term: "Refund or credit",
    category: "Expenses & labor",
    definition: "Money returned from an earlier purchase. It reduces cash outflow and reverses the original record's classification.",
  },
  {
    id: "worker-type",
    term: "Worker type",
    category: "Expenses & labor",
    definition: "Identifies whether labor was performed by an employee, owner, or contractor.",
  },
  {
    id: "direct-labor",
    term: "Direct labor",
    category: "Expenses & labor",
    definition: "Labor that performs and delivers customer work.",
  },
  {
    id: "management-labor",
    term: "Management labor",
    category: "Expenses & labor",
    definition: "Labor used to plan, administer, supervise, and operate the company.",
  },
  {
    id: "sales-labor",
    term: "Sales labor",
    category: "Expenses & labor",
    definition: "Labor used to create demand, prepare quotes, follow up, and close work.",
  },
  {
    id: "labor-class",
    term: "Labor class",
    category: "Expenses & labor",
    definition: "Assigns wages or labor costs to direct, management, or sales work so labor productivity can be measured.",
  },
  {
    id: "payroll-period",
    term: "Payroll period",
    category: "Expenses & labor",
    definition: "The start and end dates covered by a labor record. Reports place the entry according to its period end date.",
  },
  {
    id: "paid-date",
    term: "Paid date",
    category: "Expenses & labor",
    definition: "The date wages were actually paid to the worker.",
  },
  {
    id: "regular-hours",
    term: "Regular hours",
    category: "Expenses & labor",
    definition: "Hours worked at the worker's normal pay rate during the payroll period.",
  },
  {
    id: "overtime-hours",
    term: "Overtime hours",
    category: "Expenses & labor",
    definition: "Hours worked that qualify for an overtime pay rate under the applicable payroll rules.",
  },
  {
    id: "gross-wages",
    term: "Gross wages",
    category: "Expenses & labor",
    definition: "Pay earned before employee taxes, withholding, or other deductions.",
  },
  {
    id: "employer-payroll-taxes",
    term: "Employer payroll taxes",
    category: "Expenses & labor",
    definition: "Payroll taxes paid by the company in addition to the worker's gross wages.",
  },
  {
    id: "benefits",
    term: "Benefits",
    category: "Expenses & labor",
    definition: "Employer-paid health, retirement, insurance, or similar costs attributable to labor.",
  },
  {
    id: "book-cash",
    term: "Book cash balance",
    category: "Month end & equipment",
    definition: "The cash balance recorded in the company's accounting records at month end.",
  },
  {
    id: "bank-cash",
    term: "Bank statement cash",
    category: "Month end & equipment",
    definition: "The ending cash balance shown on the bank statement for the same month.",
  },
  {
    id: "accounts-receivable",
    term: "Accounts receivable",
    category: "Month end & equipment",
    definition: "Amounts customers owe for work already invoiced but not yet paid.",
    source: "The month-end checklist compares this entry with invoices currently marked unpaid.",
  },
  {
    id: "accounts-payable",
    term: "Accounts payable",
    category: "Month end & equipment",
    definition: "Bills and supplier obligations the business owes but has not yet paid.",
  },
  {
    id: "inventory",
    term: "Inventory",
    category: "Month end & equipment",
    definition: "Materials or goods owned and available for future work or sale at month end.",
  },
  {
    id: "fixed-assets-net",
    term: "Net equipment and fixed assets",
    category: "Month end & equipment",
    definition: "Recorded fixed-asset cost minus accumulated depreciation.",
  },
  {
    id: "taxes-payable",
    term: "Taxes payable",
    category: "Month end & equipment",
    definition: "Taxes incurred or collected but not yet remitted at month end.",
  },
  {
    id: "credit-card-balance",
    term: "Credit card balance",
    category: "Month end & equipment",
    definition: "Outstanding business credit-card debt at month end.",
  },
  {
    id: "short-term-debt",
    term: "Short-term debt",
    category: "Month end & equipment",
    definition: "Borrowings expected to be repaid within approximately one year.",
  },
  {
    id: "long-term-debt",
    term: "Long-term debt",
    category: "Month end & equipment",
    definition: "The portion of business borrowing due beyond approximately one year.",
  },
  {
    id: "cash-reconciliation",
    term: "Cash reconciliation",
    category: "Month end & equipment",
    definition: "The process of explaining and resolving the difference between book cash and bank statement cash.",
    formula: "Cash difference = bank statement cash - book cash",
    action: "The app permits marking cash reconciled only when the balances agree within one cent.",
  },
  {
    id: "purchase-date",
    term: "Equipment purchase date",
    category: "Month end & equipment",
    definition: "The date the business acquired the equipment. This may differ from the date it was placed in service.",
  },
  {
    id: "purchase-cost",
    term: "Equipment purchase cost",
    category: "Month end & equipment",
    definition: "The recorded acquisition cost of equipment, including costs included in its accounting basis.",
  },
  {
    id: "in-service-date",
    term: "Placed in service date",
    category: "Month end & equipment",
    definition: "The date equipment became available for business use and management depreciation begins.",
  },
  {
    id: "salvage-value",
    term: "Estimated salvage value",
    category: "Month end & equipment",
    definition: "The estimated value remaining when the equipment reaches the end of its useful life.",
  },
  {
    id: "useful-life",
    term: "Useful life",
    category: "Month end & equipment",
    definition: "The number of months over which the equipment's depreciable cost is allocated for management reporting.",
  },
  {
    id: "straight-line-depreciation",
    term: "Straight-line depreciation",
    category: "Month end & equipment",
    definition: "Allocates the same amount of depreciable cost to each month of the equipment's useful life.",
    formula: "Monthly depreciation = (purchase cost - salvage value) / useful-life months",
    action: "Use your accountant's schedule for official tax depreciation.",
  },
  {
    id: "original-loan-amount",
    term: "Original loan amount",
    category: "Month end & equipment",
    definition: "Principal financed when the equipment loan began.",
  },
  {
    id: "loan-balance",
    term: "Current loan balance",
    category: "Month end & equipment",
    definition: "Principal still owed according to the latest lender statement.",
  },
  {
    id: "loan-interest-rate",
    term: "Loan interest rate",
    category: "Month end & equipment",
    definition: "Annual percentage rate charged by the lender on the equipment borrowing.",
  },
  {
    id: "loan-maturity-date",
    term: "Loan maturity date",
    category: "Month end & equipment",
    definition: "The scheduled date when the remaining loan obligation becomes due.",
  },
  {
    id: "revenue",
    term: "Revenue",
    category: "Reports & metrics",
    definition: "Business income recognized during the reporting period according to the selected cash or accrual basis.",
    source: "Collected payments on cash basis or eligible invoices on accrual basis.",
  },
  {
    id: "gross-margin",
    term: "Gross margin",
    category: "Reports & metrics",
    definition: "Revenue remaining after direct non-labor job costs. It is available to pay labor, overhead, depreciation, and profit.",
    formula: "Gross margin = revenue - COGS",
  },
  {
    id: "contribution-margin",
    term: "Contribution margin",
    category: "Reports & metrics",
    definition: "Gross margin remaining after direct labor. It supports management labor, sales labor, overhead, and profit.",
    formula: "Contribution margin = gross margin - direct labor",
  },
  {
    id: "payroll-burden",
    term: "Payroll taxes and benefits",
    category: "Reports & metrics",
    definition: "Employer payroll taxes and benefits paid in addition to gross wages.",
    formula: "Payroll burden = employer payroll taxes + benefits",
  },
  {
    id: "pretax-profit",
    term: "Pretax profit",
    category: "Reports & metrics",
    definition: "Normalized operating profit before income taxes, after fair owner pay and management depreciation.",
    formula: "Gross margin - total labor - payroll burden - operating expense - depreciation",
  },
  {
    id: "profit-to-gross-margin",
    term: "Profit to gross margin",
    category: "Reports & metrics",
    definition: "The share of gross margin retained as normalized pretax profit.",
    formula: "Pretax profit / gross margin",
    action: "Compare it with the configured minimum, target, and stretch percentages.",
  },
  {
    id: "total-ler",
    term: "Total LER",
    category: "Reports & metrics",
    definition: "Labor Efficiency Ratio showing how many gross-margin dollars the company produces for each dollar of total normalized labor.",
    formula: "Total LER = gross margin / total labor",
    action: "A result below target points to pricing, direct costs, staffing, or labor productivity for review.",
  },
  {
    id: "direct-ler",
    term: "Direct LER",
    category: "Reports & metrics",
    definition: "Gross margin generated per dollar of direct labor.",
    formula: "Direct LER = gross margin / direct labor",
  },
  {
    id: "management-ler",
    term: "Management LER",
    category: "Reports & metrics",
    definition: "Contribution margin available per dollar of management labor.",
    formula: "Management LER = contribution margin / management labor",
  },
  {
    id: "salary-cap",
    term: "Salary cap",
    category: "Reports & metrics",
    definition: "The total normalized labor amount supported by current gross margin at the configured Total LER target.",
    formula: "Salary cap = gross margin / target Total LER",
  },
  {
    id: "salary-headroom",
    term: "Salary headroom",
    category: "Reports & metrics",
    definition: "The amount by which the salary cap exceeds current normalized labor. A negative value means labor is above target capacity.",
    formula: "Salary headroom = salary cap - total normalized labor",
  },
  {
    id: "core-capital",
    term: "Core capital",
    category: "Reports & metrics",
    definition: "Cash reserve intended to cover a configured number of average operating-cost months.",
    formula: "Average monthly labor, payroll burden, and operating expense x core-capital months",
  },
  {
    id: "core-capital-actual",
    term: "Core capital actual",
    category: "Reports & metrics",
    definition: "Bank cash entered in the latest available month-end snapshot.",
  },
  {
    id: "core-capital-surplus",
    term: "Core capital surplus",
    category: "Reports & metrics",
    definition: "Bank cash above or below the calculated core-capital target.",
    formula: "Core capital actual - core capital target",
  },
  {
    id: "invested-capital",
    term: "Invested capital",
    category: "Reports & metrics",
    definition: "Net capital currently committed to business operations based on the latest month-end balances.",
    formula: "Bank cash + receivables + inventory + net fixed assets - payables - taxes - credit cards - short-term debt - long-term debt",
  },
  {
    id: "roic",
    term: "Annualized ROIC",
    category: "Reports & metrics",
    definition: "Annualized return on invested capital based on normalized management pretax profit.",
    formula: "Annualized pretax profit / invested capital",
  },
  {
    id: "cash-operating-surplus",
    term: "Cash operating surplus",
    category: "Reports & metrics",
    definition: "Collected revenue remaining after operating expenses, before asset purchases and other non-operating cash movement.",
    formula: "Paid revenue - operating expenses",
  },
  {
    id: "cash-net",
    term: "Cash net",
    category: "Reports & metrics",
    definition: "Collected revenue remaining after all recorded cash outflows, including asset purchases and net of refunds.",
    formula: "Paid revenue - net cash outflow",
  },
  {
    id: "outstanding-invoices",
    term: "Outstanding invoices",
    category: "Reports & metrics",
    definition: "Total value of invoices currently marked unpaid.",
  },
  {
    id: "quoted-pipeline",
    term: "Quoted pipeline",
    category: "Reports & metrics",
    definition: "Total quoted value of draft, sent, and accepted quotes that remain in the sales workflow.",
  },
  {
    id: "quote-acceptance",
    term: "Quote acceptance",
    category: "Reports & metrics",
    definition: "Share of quotes with a recorded outcome that were accepted or converted to jobs.",
    formula: "Accepted and converted quotes / all quotes with a recorded outcome",
  },
];

const termsById = new Map(financialGuideTerms.map((term) => [term.id, term]));

export function getFinancialGuideTerm(id: string) {
  return termsById.get(id);
}

export function contextualFinancialGuideAnchor(pathname: string) {
  if (pathname.startsWith("/reports/settings")) return "owner-compensation";
  if (pathname.startsWith("/reports")) return "reporting-metrics";
  if (pathname.startsWith("/labor")) return "labor-payroll";
  if (pathname.startsWith("/finance/month-end")) return "month-end";
  if (pathname.startsWith("/finance")) return "monthly-workflow";
  if (pathname.startsWith("/expenses")) return "expense-classifications";
  if (pathname.startsWith("/equipment")) return "equipment-finance";
  return "financial-workflow";
}
