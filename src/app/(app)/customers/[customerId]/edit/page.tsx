import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { getCustomerDetail } from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const customerId = Number((await params).customerId);
  if (!Number.isInteger(customerId)) notFound();
  const { business } = await requireBusinessContext();
  const customer = await getCustomerDetail(await createClient(), business.id, customerId);
  if (!customer) notFound();
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader description={customer.displayName} title="Edit customer" /><CustomerForm customer={customer} /></div>;
}
