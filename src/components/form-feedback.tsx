type FormFeedbackProps = {
  message?: string;
  tone?: "danger" | "success";
};

export function FormFeedback({ message, tone = "danger" }: FormFeedbackProps) {
  if (!message) {
    return null;
  }

  const classes = tone === "success"
    ? "border-brand-border bg-brand-soft text-brand-strong"
    : "border-danger-line bg-danger-soft text-danger-strong";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${classes}`} role={tone === "danger" ? "alert" : "status"}>
      {message}
    </p>
  );
}
