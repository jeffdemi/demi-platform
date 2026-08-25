import { inputClass } from "@/components/form-fields";

export function CategoryCombobox({ id, name, categories, defaultValue, required, placeholder, onChange, className }: {
  id: string;
  name: string;
  categories: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const listId = `${id}-options`;
  return <>
    <input className={className ?? inputClass} defaultValue={defaultValue} id={id} list={listId} name={name} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder ?? "Select or type a category"} required={required} />
    <datalist id={listId}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
  </>;
}
