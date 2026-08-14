"use client";

import Link from "next/link";
import { Info, X } from "lucide-react";
import { useRef } from "react";
import { getFinancialGuideTerm } from "@/lib/financial-guide";

export function FinancialTermHelp({ termId }: { termId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const term = getFinancialGuideTerm(termId);
  if (!term) return null;

  return <>
    <button
      aria-label={`Explain ${term.term}`}
      className="grid size-7 shrink-0 place-items-center rounded-full text-brand hover:bg-brand-soft"
      onClick={() => dialogRef.current?.showModal()}
      title={`Explain ${term.term}`}
      type="button"
    >
      <Info aria-hidden="true" size={16} />
    </button>
    <dialog
      aria-labelledby={`financial-term-${term.id}`}
      className="fixed bottom-0 left-0 m-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/35 sm:inset-0 sm:m-auto sm:w-[min(92vw,480px)] sm:rounded-lg"
      ref={dialogRef}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="text-lg font-bold" id={`financial-term-${term.id}`}>{term.term}</h2>
        <button aria-label="Close definition" className="grid size-9 place-items-center rounded-md hover:bg-surface-muted" onClick={() => dialogRef.current?.close()} title="Close" type="button"><X aria-hidden="true" size={18} /></button>
      </div>
      <div className="space-y-4 px-5 py-5 text-sm leading-6">
        <p>{term.definition}</p>
        {term.formula ? <div><p className="text-xs font-bold uppercase text-muted">Formula</p><p className="mt-1 font-semibold">{term.formula}</p></div> : null}
        {term.source ? <div><p className="text-xs font-bold uppercase text-muted">Data source</p><p className="mt-1">{term.source}</p></div> : null}
        {term.action ? <div><p className="text-xs font-bold uppercase text-muted">Use it</p><p className="mt-1">{term.action}</p></div> : null}
      </div>
      <div className="border-t border-line px-5 py-4">
        <Link className="font-semibold text-brand" href={`/help/financial-guide#${term.id}`} onClick={() => dialogRef.current?.close()}>Open in financial guide</Link>
      </div>
    </dialog>
  </>;
}
