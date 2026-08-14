import { apiBusinessContext, csvResponse } from "@/lib/api-auth";
import { buildBookkeepingStatements } from "@/lib/domain/bookkeeping";
import { getLedgerReport } from "@/lib/repositories/accounting-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.get("from") ?? "") ? query.get("from")! : `${today.slice(0, 4)}-01-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.get("to") ?? "") ? query.get("to")! : today;
  const ledger = await getLedgerReport(context.client, context.businessId, undefined, to);
  const reports = buildBookkeepingStatements({ entries: ledger.entries, lines: ledger.lines, from, to });
  const statement = query.get("statement") ?? "trial_balance";
  const rows = statement === "profit_loss"
    ? reports.profitLoss.rows.map((row) => ({ code: row.account.code, account: row.account.name, type: row.account.account_type, amount: row.balance }))
    : statement === "balance_sheet"
      ? reports.balanceSheet.rows.map((row) => ({ code: row.account.code, account: row.account.name, type: row.account.account_type, amount: row.balance }))
      : statement === "cash_flow"
        ? [{ section: "Operating activities", amount: reports.cashFlow.operating }, { section: "Investing activities", amount: reports.cashFlow.investing }, { section: "Financing activities", amount: reports.cashFlow.financing }, { section: "Net cash change", amount: reports.cashFlow.netChange }]
        : reports.trialBalance.rows.map((row) => ({ code: row.account.code, account: row.account.name, debit: row.debit, credit: row.credit }));
  if (query.get("format") === "csv") return csvResponse(rows, `${statement}-${from}-${to}.csv`);
  return Response.json({ from, to, statement, data: rows });
}
