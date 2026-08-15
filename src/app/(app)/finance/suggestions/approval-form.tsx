"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ClassificationSuggestion } from "@/lib/repositories/accounting-repository";
import { approveClassificationSuggestions, type SuggestionApprovalState } from "./actions";

export function SuggestionApprovalForm({ suggestions }: { suggestions: ClassificationSuggestion[] }) {
  const [selected, setSelected] = useState(() => new Set(suggestions.map((item) => item.transaction.id)));
  const [state, action, pending] = useActionState(approveClassificationSuggestions, {} as SuggestionApprovalState);
  const allSelected = suggestions.length > 0 && selected.size === suggestions.length;
  return <form action={action} className="space-y-4"><label className="inline-flex items-center gap-2 font-semibold"><input checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(suggestions.map((item) => item.transaction.id)) : new Set())} type="checkbox" />Select all</label><div className="overflow-x-auto rounded-lg border border-line"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="w-12 px-4 py-3">Use</th><th className="px-4 py-3">Transaction</th><th className="px-4 py-3">Suggested classification</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-line">{suggestions.map(({ transaction, rule }) => <tr key={transaction.id}><td className="px-4 py-4"><input checked={selected.has(transaction.id)} name="suggestion" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(transaction.id); else next.delete(transaction.id); return next; })} type="checkbox" value={`${transaction.id}:${rule.id}`} /></td><td className="px-4 py-4"><p className="font-semibold">{transaction.description}</p><p className="text-muted">{formatDate(transaction.transaction_date)} · matched “{rule.match_text}”</p></td><td className="px-4 py-4"><p className="font-semibold">{rule.ledger_accounts?.code} · {rule.ledger_accounts?.name}</p><p className="text-muted">{rule.tax_category || "No tax category"} · {rule.deductible_percent}% deductible</p></td><td className="px-4 py-4 text-right font-bold">{formatCurrency(Math.abs(transaction.amount))}</td></tr>)}</tbody></table></div><FormFeedback message={state.message} tone={state.success ? "success" : "danger"} /><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || selected.size === 0}><CheckCircle2 size={17} />{pending ? "Approving..." : `Approve ${selected.size} selected`}</button></form>;
}
