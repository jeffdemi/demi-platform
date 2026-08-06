export const invoiceStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
] as const;

export const expenseCategories = [
  "Fuel", "Maintenance", "Repairs", "Parts", "Tools", "Trailer", "Insurance", "Advertising",
  "Office", "Subcontractor", "General", "Other",
] as const;

export const expenseTypeOptions = [
  { value: "expense", label: "Operating expense" },
  { value: "asset", label: "Asset purchase" },
  { value: "refund", label: "Refund / credit" },
] as const;

export type ExpenseType = typeof expenseTypeOptions[number]["value"];

type FinancialExpense = {
  amount: number;
  transaction_type?: string;
  voided_at?: string | null;
};

export function expenseTypeLabel(type: string) {
  return expenseTypeOptions.find((option) => option.value === type)?.label
    ?? type.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function operatingExpenseImpact(expense: FinancialExpense) {
  if (expense.voided_at || expense.transaction_type === "asset") return 0;
  return expense.transaction_type === "refund" ? -expense.amount : expense.amount;
}

export function cashOutflowImpact(expense: FinancialExpense) {
  if (expense.voided_at) return 0;
  return expense.transaction_type === "refund" ? -expense.amount : expense.amount;
}

export function invoiceStatusLabel(status: string) {
  return invoiceStatusOptions.find((option) => option.value === status)?.label
    ?? status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
