"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckSquare2, Pencil } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { StatusBadge } from "@/components/status-badge";
import { cashOutflowImpact, expenseTypeLabel } from "@/lib/domain/finance";
import { financialClassificationLabel, financialClassificationOptions, laborClassOptions } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import type { ExpenseWithRelations } from "@/lib/repositories/expense-repository";
import { bulkClassifySelectedExpenses, type BulkClassificationState } from "./actions";

type SortField = "date" | "type" | "category" | "managementClass" | "vendor" | "linkedRecord" | "cashImpact";
type SortDirection = "asc" | "desc";

function linkedRecordLabel(expense: ExpenseWithRelations) {
  if (expense.jobs) return expense.jobs.work_description || `Job #${expense.jobs.id}`;
  return expense.equipment?.name || "";
}

function sortValue(expense: ExpenseWithRelations, field: SortField): string | number {
  switch (field) {
    case "type":
      return expenseTypeLabel(expense.transaction_type);
    case "category":
      return expense.category || "";
    case "managementClass":
      return financialClassificationLabel(expense.financial_classification);
    case "vendor":
      return `${expense.vendor || ""} ${expense.description || ""}`.trim();
    case "linkedRecord":
      return linkedRecordLabel(expense);
    case "cashImpact":
      return cashOutflowImpact(expense);
    case "date":
    default:
      return expense.expense_date;
  }
}

const columns: { field: SortField; label: string; align?: "right" }[] = [
  { field: "date", label: "Date" },
  { field: "type", label: "Type" },
  { field: "category", label: "Category" },
  { field: "managementClass", label: "Management class" },
  { field: "vendor", label: "Vendor / description" },
  { field: "linkedRecord", label: "Linked record" },
  { field: "cashImpact", label: "Cash impact", align: "right" },
];

export function ExpenseClassificationTable({ expenses, canClassify }: { expenses: ExpenseWithRelations[]; canClassify: boolean }) {
  const [state, action, pending] = useActionState(bulkClassifySelectedExpenses, {} as BulkClassificationState);
  const [selected, setSelected] = useState<number[]>([]);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const selectableIds = expenses.filter((expense) => !expense.voided_at).map((expense) => expense.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleAll = () => setSelected(allSelected ? [] : selectableIds);
  const sortedExpenses = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...expenses].sort((left, right) => {
      const leftValue = sortValue(left, sortField);
      const rightValue = sortValue(right, sortField);
      if (typeof leftValue === "number" && typeof rightValue === "number") return direction * (leftValue - rightValue);
      return direction * String(leftValue).localeCompare(String(rightValue));
    });
  }, [expenses, sortField, sortDirection]);
  const sortBy = (field: SortField) => {
    if (field === sortField) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  return <form action={action}>
    {canClassify ? <div className="mb-3 rounded-lg border border-line bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex h-11 items-center gap-2 px-1 text-sm font-semibold"><input checked={allSelected} disabled={!selectableIds.length} onChange={toggleAll} type="checkbox" />Select all shown</label>
        <label className="grid gap-1 text-sm font-semibold"><span>Classification</span><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue="operating" name="financialClassification">{financialClassificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold"><span>Labor class, if applicable</span><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue="" name="laborClass"><option value="">Not applicable</option>{laborClassOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || selected.length === 0}><CheckSquare2 size={17} />{pending ? "Applying..." : `Apply to ${selected.length} selected`}</button>
      </div>
      <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    </div> : null}
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr>{canClassify ? <th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th> : null}{columns.map((column) => <th className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`} key={column.field}><button className={`inline-flex items-center gap-1 hover:text-body ${column.align === "right" ? "flex-row-reverse" : ""}`} onClick={() => sortBy(column.field)} type="button">{column.label}{sortField === column.field ? (sortDirection === "asc" ? <ArrowUp aria-hidden="true" size={12} /> : <ArrowDown aria-hidden="true" size={12} />) : null}</button></th>)}<th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-line">{sortedExpenses.map((expense) => <tr className={expense.voided_at ? "opacity-55" : ""} key={expense.id}>{canClassify ? <td className="px-4 py-4"><input aria-label={`Select expense ${expense.id}`} checked={selected.includes(expense.id)} disabled={Boolean(expense.voided_at)} name="expenseId" onChange={() => toggle(expense.id)} type="checkbox" value={expense.id} /></td> : null}<td className="px-4 py-4"><Link className="font-semibold text-brand" href={`/expenses/${expense.id}`}>{expense.expense_date}</Link></td><td className="px-4 py-4"><StatusBadge label={expense.voided_at ? "Archived" : expenseTypeLabel(expense.transaction_type)} status={expense.voided_at ? "void" : expense.transaction_type} /></td><td className="px-4 py-4 font-semibold">{expense.category}</td><td className="px-4 py-4 text-sm"><p>{financialClassificationLabel(expense.financial_classification)}</p>{!expense.financial_classification_reviewed ? <p className="text-xs font-semibold text-danger">Classification review needed</p> : null}</td><td className="px-4 py-4"><p>{expense.vendor || "No vendor"}</p><p className="text-sm text-muted">{expense.description || "No description"}</p></td><td className="px-4 py-4 text-sm">{expense.jobs ? <Link className="text-brand" href={`/jobs/${expense.jobs.id}`}>{expense.jobs.work_description || `Job #${expense.jobs.id}`}</Link> : expense.equipment?.name || "Not linked"}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{formatCurrency(cashOutflowImpact(expense))}</td><td className="px-4 py-4">{!expense.voided_at ? <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold" href={`/expenses/${expense.id}/edit`}><Pencil size={15} />Edit</Link> : null}</td></tr>)}{!expenses.length ? <tr><td className="px-5 py-14 text-center text-muted" colSpan={canClassify ? 9 : 8}>No financial records found.</td></tr> : null}</tbody></table></div></div>
  </form>;
}
