export const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
export const textAreaClass = "min-h-28 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function Field({ label, name, errors, help, children }: { label: string; name: string; errors?: string[]; help?: React.ReactNode; children: React.ReactNode }) {
  return <div><div className="mb-2 flex min-h-7 items-center gap-1"><label className="block text-sm font-semibold text-muted-strong" htmlFor={name}>{label}</label>{help}</div>{children}{errors?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}</div>;
}
