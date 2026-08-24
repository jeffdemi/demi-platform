import { apiBusinessContext, csvResponse } from "@/lib/api-auth";
import { buildMonthlyLedgerGrids } from "@/lib/domain/bookkeeping";
import { buildMonthlyExpenseCategoryGrid } from "@/lib/domain/reports";
import { getLedgerReport } from "@/lib/repositories/accounting-repository";
import { getReportData } from "@/lib/repositories/reporting-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const requestedYear = Number(query.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : Number(today.slice(0, 4));
  const to = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`;
  const line = query.get("line");
  const businessLineId = line && /^\d+$/.test(line) ? Number(line) : undefined;
  const statement = query.get("statement") ?? "pl";
  const monthColumns = (row: number[]) => Object.fromEntries(row.map((value, index) => [`month_${index + 1}`, value]));

  if (statement === "expense") {
    const reportData = await getReportData(context.client, context.businessId);
    const grid = buildMonthlyExpenseCategoryGrid(reportData.expenses, year, to);
    const rows = grid.map((row) => ({ category: row.category, ...monthColumns(row.monthly), total: row.total }));
    if (query.get("format") === "csv") return csvResponse(rows, `monthly-expense-by-category-${year}.csv`);
    return Response.json({ year, statement, data: rows });
  }

  const ledger = await getLedgerReport(context.client, context.businessId, undefined, to);
  const grids = buildMonthlyLedgerGrids({ entries: ledger.entries, lines: ledger.lines, year, to, businessLineId });

  const rows = statement === "bs"
    ? grids.balanceSheet.rows.map((row) => ({ code: row.account.code, account: row.account.name, type: row.account.account_type, ...monthColumns(row.monthly.map((value) => value ?? 0)) }))
    : statement === "cf"
      ? [
        ...grids.cashFlow.rows.map((row) => ({ section: `${row.section} activities`, ...monthColumns(row.monthly), total: row.total })),
        { section: "Net cash change", ...monthColumns(grids.cashFlow.netChange.monthly), total: grids.cashFlow.netChange.total },
      ]
      : grids.profitLoss.rows.map((row) => ({ code: row.account.code, account: row.account.name, type: row.account.account_type, ...monthColumns(row.monthly), total: row.total }));

  if (query.get("format") === "csv") return csvResponse(rows, `monthly-${statement}-${year}.csv`);
  return Response.json({ year, statement, data: rows });
}
