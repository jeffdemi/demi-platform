export const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
export const textAreaClass = "min-h-28 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function Field({ label, name, errors, children }: { label: string; name: string; errors?: string[]; children: React.ReactNode }) {
  return <div><label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor={name}>{label}</label>{children}{errors?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}</div>;
}
