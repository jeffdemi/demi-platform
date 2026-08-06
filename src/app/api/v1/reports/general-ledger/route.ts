import { apiBusinessContext, csvResponse } from "@/lib/api-auth";
import { getLedgerReport } from "@/lib/repositories/accounting-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.get("from") || "") ? query.get("from")! : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.get("to") || "") ? query.get("to")! : undefined;
  const ledger = await getLedgerReport(context.client, context.businessId, from, to);
  const entries = new Map(ledger.entries.map((entry) => [entry.id, entry]));
  const rows = ledger.lines.map((line) => {
    const entry = entries.get(line.journal_entry_id);
    return {
      date: entry?.entry_date,
      entry_id: line.journal_entry_id,
      source_type: entry?.source_type,
      source_id: entry?.source_id,
      description: entry?.description,
      account_code: line.ledger_accounts?.code,
      account_name: line.ledger_accounts?.name,
      debit: line.debit,
      credit: line.credit,
      memo: line.memo,
    };
  });
  if (query.get("format") === "csv") return csvResponse(rows, "general-ledger.csv");
  return Response.json({ entries: ledger.entries, lines: rows });
}
