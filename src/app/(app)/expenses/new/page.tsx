import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../expense-form";
export const metadata: Metadata = { title: "Add expense" };
export default async function NewExpensePage() { const { business } = await requireBusinessContext(); const client = await createClient(); const [jobs, equipment] = await Promise.all([listJobOptions(client, business.id), listActiveEquipmentOptions(client, business.id)]); return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Track business costs and connect them to jobs or equipment." title="Add expense" /><ExpenseForm equipment={equipment} jobs={jobs} today={dateInTimeZone(business.timezone)} /></div>; }
