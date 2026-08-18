import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const context = await requireBusinessContext();
  if (context.role === "intern") redirect("/customers");
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader description="Create a customer record for quotes and jobs." title="Add customer" /><CustomerForm /></div>;
}
