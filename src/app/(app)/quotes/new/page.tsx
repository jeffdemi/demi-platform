import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";
import { QuoteForm } from "../quote-form";
export const metadata: Metadata = { title: "Add quote" };
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) { const { business, role } = await requireBusinessContext(); if (role === "intern") redirect("/quotes"); const customers = await listActiveCustomerOptions(await createClient(), business.id); const customerId = Number((await searchParams).customerId); return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Start a draft estimate, then prepare it with site photos." title="Add quote" /><QuoteForm customers={customers} defaultCustomerId={Number.isInteger(customerId) ? customerId : undefined} today={dateInTimeZone(business.timezone)} /></div>; }
