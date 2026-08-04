export const invoiceStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
] as const;

export const expenseCategories = [
  "Fuel", "Maintenance", "Parts", "Insurance", "Advertising", "Office", "Subcontractor", "Other",
] as const;

export function invoiceStatusLabel(status: string) {
  return invoiceStatusOptions.find((option) => option.value === status)?.label
    ?? status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
