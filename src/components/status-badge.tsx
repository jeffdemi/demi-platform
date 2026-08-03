export function StatusBadge({ label, status }: { label: string; status: string }) {
  const tone = status === "cancelled" || status === "declined"
    ? "border-danger-line bg-danger-soft text-danger-strong"
    : status === "paid" || status === "completed" || status === "accepted"
      ? "border-brand-border bg-brand-soft text-brand-strong"
      : "border-line bg-surface-muted text-muted-strong";

  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
