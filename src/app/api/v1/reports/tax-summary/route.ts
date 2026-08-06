import { buildTaxExpenseSummary } from "@/lib/domain/accounting";
import { apiBusinessContext, csvResponse } from "@/lib/api-auth";
import { getTaxExpenses } from "@/lib/repositories/accounting-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const requestedYear = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : new Date().getUTCFullYear();
  const expenses = await getTaxExpenses(context.client, context.businessId, year);
  const summary = buildTaxExpenseSummary(expenses);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const rows = expenses.filter((expense) => !expense.voided_at).map((expense) => ({
      date: expense.expense_date,
      type: expense.transaction_type,
      vendor: expense.vendor,
      description: expense.description,
      tax_category: expense.tax_category || expense.category,
      source_amount: expense.amount,
      deductible_percent: expense.deductible_percent,
      deductible_amount: expense.transaction_type === "asset" ? 0 : (expense.transaction_type === "refund" ? -1 : 1) * expense.amount * expense.deductible_percent / 100,
    }));
    return csvResponse(rows, `tax-expenses-${year}.csv`);
  }
  return Response.json({ year, summary, expenses });
}
