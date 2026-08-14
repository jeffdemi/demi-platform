import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { getBusinessIdentity } from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";
import { BusinessIdentityForm } from "../business-forms";
export const metadata: Metadata = { title: "Business Identity" };
export default async function BusinessSettingsPage() { const context = await requireBusinessContext(); const identity = await getBusinessIdentity(await createClient(), context.business.id); return <div className="mx-auto w-full max-w-[900px] px-4 py-6"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Separate the LLC legal identity, tax treatment, and customer-facing brands." title="Business Identity" /><section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm"><BusinessIdentityForm fallbackBrand={context.business.name} fallbackLegalName={context.business.name} identity={identity} /></section></div>; }
