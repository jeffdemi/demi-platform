import type { Database } from "@/types/database";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];

export function customerDisplayName(
  customer: Pick<Customer, "company_name" | "customer_type" | "first_name" | "last_name">,
) {
  const companyName = customer.company_name?.trim();
  if (customer.customer_type === "company" && companyName) return companyName;

  const personalName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return personalName || companyName || "Unnamed customer";
}

export function customerMatchesSearch(
  customer: Pick<Customer, "company_name" | "email" | "first_name" | "last_name" | "phone">,
  search: string,
) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    customer.first_name,
    customer.last_name,
    customer.company_name,
    customer.phone,
    customer.email,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}
