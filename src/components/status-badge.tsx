const positiveStatuses = new Set(["paid", "completed", "accepted", "active", "reconciled", "approved"]);
const warningStatuses = new Set(["sent", "scheduled", "pending", "awaiting_response", "partial", "overdue"]);
const negativeStatuses = new Set(["cancelled", "declined", "void", "failed", "rejected"]);
const infoStatuses = new Set(["in_progress", "converted", "review", "unreviewed"]);

export function StatusBadge({ label, status }: { label: string; status: string }) {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  const tone = positiveStatuses.has(normalized) ? "status-positive"
    : warningStatuses.has(normalized) ? "status-warning"
      : negativeStatuses.has(normalized) ? "status-negative"
        : infoStatuses.has(normalized) ? "status-info"
          : "status-neutral";
  return <span className={`status-badge ${tone}`}><span aria-hidden="true" className="status-dot" />{label}</span>;
}
