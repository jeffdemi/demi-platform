export type LedgerAccount = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  system_key: string | null;
};

export type BookkeepingEntry = {
  id: number;
  business_line_id?: number | null;
  entry_date: string;
  description: string;
  source_type: string;
  status?: string;
};

export type BookkeepingLine = {
  journal_entry_id: number;
  debit: number;
  credit: number;
  bank_account_id?: number | null;
  ledger_accounts: LedgerAccount | null;
};

export type StatementPeriod = {
  opening_balance: number;
  closing_balance: number;
};

export type StatementTransaction = { amount: number; status: string };
export type StatementCashLine = { debit: number; credit: number };

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildStatementReconciliation(
  period: StatementPeriod,
  transactions: StatementTransaction[],
  cashLines: StatementCashLine[],
) {
  const statementActivity = rounded(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  const bookActivity = rounded(cashLines.reduce((sum, line) => sum + line.debit - line.credit, 0));
  const statementEnding = rounded(period.opening_balance + statementActivity);
  const bookEnding = rounded(period.opening_balance + bookActivity);
  return {
    statementActivity,
    bookActivity,
    statementEnding,
    bookEnding,
    statementDifference: rounded(statementEnding - period.closing_balance),
    bookDifference: rounded(bookEnding - period.closing_balance),
    pendingCount: transactions.filter((transaction) => ["unreviewed", "partially_matched"].includes(transaction.status)).length,
  };
}

function statementBalance(account: LedgerAccount, debit: number, credit: number) {
  return ["asset", "expense"].includes(account.account_type) ? debit - credit : credit - debit;
}

export function buildBookkeepingStatements(input: {
  entries: BookkeepingEntry[];
  lines: BookkeepingLine[];
  from: string;
  to: string;
  businessLineId?: number;
}) {
  const selectedEntries = input.businessLineId === undefined ? input.entries : input.entries.filter((entry) => entry.business_line_id === input.businessLineId);
  const entries = new Map(selectedEntries.map((entry) => [entry.id, entry]));
  const inRange = (line: BookkeepingLine) => {
    const date = entries.get(line.journal_entry_id)?.entry_date;
    return Boolean(date && date >= input.from && date <= input.to);
  };
  const throughEnd = (line: BookkeepingLine) => {
    const date = entries.get(line.journal_entry_id)?.entry_date;
    return Boolean(date && date <= input.to);
  };
  const aggregate = (lines: BookkeepingLine[]) => {
    const values = new Map<number, { account: LedgerAccount; debit: number; credit: number }>();
    lines.forEach((line) => {
      const account = line.ledger_accounts;
      if (!account) return;
      const current = values.get(account.id) ?? { account, debit: 0, credit: 0 };
      current.debit += line.debit;
      current.credit += line.credit;
      values.set(account.id, current);
    });
    return [...values.values()].map((value) => ({
      ...value,
      debit: rounded(value.debit),
      credit: rounded(value.credit),
      balance: rounded(statementBalance(value.account, value.debit, value.credit)),
    })).sort((left, right) => left.account.code.localeCompare(right.account.code));
  };

  const periodAccounts = aggregate(input.lines.filter(inRange));
  const endingAccounts = aggregate(input.lines.filter(throughEnd));
  const profitLossRows = periodAccounts.filter((row) => ["revenue", "expense"].includes(row.account.account_type));
  const revenue = rounded(profitLossRows.filter((row) => row.account.account_type === "revenue").reduce((sum, row) => sum + row.balance, 0));
  const expenses = rounded(profitLossRows.filter((row) => row.account.account_type === "expense").reduce((sum, row) => sum + row.balance, 0));

  const balanceRows = endingAccounts.filter((row) => ["asset", "liability", "equity"].includes(row.account.account_type));
  const assets = rounded(balanceRows.filter((row) => row.account.account_type === "asset").reduce((sum, row) => sum + row.balance, 0));
  const liabilities = rounded(balanceRows.filter((row) => row.account.account_type === "liability").reduce((sum, row) => sum + row.balance, 0));
  const equity = rounded(balanceRows.filter((row) => row.account.account_type === "equity").reduce((sum, row) => sum + row.balance, 0));
  const allTimeProfit = endingAccounts.filter((row) => ["revenue", "expense"].includes(row.account.account_type)).reduce((sum, row) => (
    row.account.account_type === "revenue" ? sum + row.balance : sum - row.balance
  ), 0);
  const cumulativeEarnings = rounded(allTimeProfit);

  const cashFlow = { operating: 0, investing: 0, financing: 0 };
  const rangeEntryIds = new Set(input.entries.filter((entry) => entry.entry_date >= input.from && entry.entry_date <= input.to).map((entry) => entry.id));
  rangeEntryIds.forEach((entryId) => {
    const lines = input.lines.filter((line) => line.journal_entry_id === entryId);
    const cashImpact = lines.filter((line) => line.ledger_accounts?.system_key === "cash")
      .reduce((sum, line) => sum + line.debit - line.credit, 0);
    if (Math.abs(cashImpact) < 0.005) return;
    const counterpart = lines.filter((line) => line.ledger_accounts?.system_key !== "cash");
    if (!counterpart.length) return;
    if (counterpart.some((line) => ["fixed_assets", "accumulated_depreciation"].includes(line.ledger_accounts?.system_key ?? ""))) {
      cashFlow.investing += cashImpact;
    } else if (counterpart.some((line) => ["liability", "equity"].includes(line.ledger_accounts?.account_type ?? ""))) {
      cashFlow.financing += cashImpact;
    } else {
      cashFlow.operating += cashImpact;
    }
  });

  const totalDebits = rounded(endingAccounts.reduce((sum, row) => sum + row.debit, 0));
  const totalCredits = rounded(endingAccounts.reduce((sum, row) => sum + row.credit, 0));
  return {
    trialBalance: {
      rows: endingAccounts,
      totalDebits,
      totalCredits,
      difference: rounded(totalDebits - totalCredits),
      balanced: Math.abs(totalDebits - totalCredits) <= 0.01,
    },
    profitLoss: {
      rows: profitLossRows,
      revenue,
      expenses,
      netIncome: rounded(revenue - expenses),
    },
    balanceSheet: {
      rows: balanceRows,
      assets,
      liabilities,
      equity,
      cumulativeEarnings,
      difference: rounded(assets - liabilities - equity - cumulativeEarnings),
    },
    cashFlow: {
      operating: rounded(cashFlow.operating),
      investing: rounded(cashFlow.investing),
      financing: rounded(cashFlow.financing),
      netChange: rounded(cashFlow.operating + cashFlow.investing + cashFlow.financing),
    },
  };
}
