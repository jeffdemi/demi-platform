"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { financialGuideCategories, financialGuideTerms } from "@/lib/financial-guide";

export function FinancialGlossary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = financialGuideTerms.filter((term) => {
    if (category && term.category !== category) return false;
    if (!deferredQuery) return true;
    return [term.term, term.definition, term.formula, term.source, term.action]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(deferredQuery));
  });

  return <>
    <div className="grid gap-3 border-y border-line py-4 sm:grid-cols-[minmax(0,1fr)_260px]">
      <label className="relative block">
        <span className="sr-only">Search financial definitions</span>
        <Search aria-hidden="true" className="absolute left-3 top-3.5 text-muted" size={18} />
        <input className="h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3" onChange={(event) => setQuery(event.target.value)} placeholder="Search terms, formulas, or definitions" type="search" value={query} />
      </label>
      <label>
        <span className="sr-only">Filter definition category</span>
        <select className="h-11 w-full rounded-md border border-line-strong bg-surface px-3" onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="">All financial topics</option>
          {financialGuideCategories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>
    <p aria-live="polite" className="py-4 text-sm text-muted">{filtered.length} definition{filtered.length === 1 ? "" : "s"}</p>
    <div className="divide-y divide-line border-y border-line">
      {filtered.map((term) => <article className="scroll-mt-6 py-5" id={term.id} key={term.id}>
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <div><h3 className="font-bold">{term.term}</h3><p className="mt-1 text-xs font-semibold uppercase text-muted">{term.category}</p></div>
          <div className="space-y-3 text-sm leading-6">
            <p>{term.definition}</p>
            {term.formula ? <p><strong>Formula:</strong> {term.formula}</p> : null}
            {term.source ? <p><strong>Data source:</strong> {term.source}</p> : null}
            {term.action ? <p><strong>Use it:</strong> {term.action}</p> : null}
          </div>
        </div>
      </article>)}
      {!filtered.length ? <p className="py-14 text-center text-muted">No definitions match those filters.</p> : null}
    </div>
  </>;
}
