import { inputClass } from "@/components/form-fields";

export function CategoryCombobox({ id, name, categories, defaultValue, required, placeholder }: {
  id: string;
  name: string;
  categories: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const listId = `${id}-options`;
  return <>
    <input className={inputClass} defaultValue={defaultValue} id={id} list={listId} name={name} placeholder={placeholder ?? "Select or type a category"} required={required} />
    <datalist id={listId}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
  </>;
}
