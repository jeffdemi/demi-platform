"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function MessageEditor({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  return <div><textarea aria-label="Customer message" className="min-h-80 w-full rounded-md border border-line-strong bg-surface p-3 text-sm leading-6" defaultValue={message} id="customer-message" /><button className="mt-3 flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold hover:bg-surface-muted" onClick={async () => { const field = document.querySelector<HTMLTextAreaElement>("#customer-message"); if (field) { await navigator.clipboard.writeText(field.value); setCopied(true); setTimeout(() => setCopied(false), 1600); } }} type="button">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy message"}</button></div>;
}
