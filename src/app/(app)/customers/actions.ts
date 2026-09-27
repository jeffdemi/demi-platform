"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { createCustomer, updateCustomer } from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";
import { customerFormSchema, valuesFromFormData } from "@/lib/validation/operations";

export type CustomerFormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

export async function saveCustomer(
  customerId: number | null,
  _: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const validated = customerFormSchema.safeParse(valuesFromFormData(formData));
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
  const client = await createClient();
  const values = {
    business_id: business.id,
    customer_type: validated.data.customerType,
    company_name: validated.data.companyName ?? null,
    first_name: validated.data.firstName ?? null,
    last_name: validated.data.lastName ?? null,
    phone: validated.data.phone ?? null,
    email: validated.data.email ?? null,
    street_address: validated.data.streetAddress ?? null,
    city: validated.data.city ?? null,
    state: validated.data.state ?? null,
    zip: validated.data.zip ?? null,
    notes: validated.data.notes ?? null,
    active: validated.data.active,
  };

  try {
    if (customerId === null) {
      const created = await createCustomer(client, values);
      revalidatePath("/customers");
      redirect(`/customers/${created.id}`);
    }

    const updated = await updateCustomer(client, business.id, customerId, values);
    if (!updated) return { message: "That customer no longer exists." };
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: "The customer could not be saved. Please try again." };
  }
}
