export const inputClass = "form-control";
export const textAreaClass = "form-control form-textarea";

export function Field({ label, name, errors, help, children }: { label: string; name: string; errors?: string[]; help?: React.ReactNode; children: React.ReactNode }) {
  return <div><div className="mb-2 flex min-h-7 items-center gap-1"><label className="block text-sm font-semibold text-muted-strong" htmlFor={name}>{label}</label>{help}</div>{children}{errors?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}</div>;
}
