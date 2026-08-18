import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { createClient } from "@/lib/supabase/server";
import { MaintenanceForm } from "../../equipment-forms";
export const metadata: Metadata = { title: "Add maintenance" };
export default async function NewMaintenancePage({ searchParams }: { searchParams: Promise<{ equipmentId?: string }> }) { const { business, role } = await requireBusinessContext(); if (role === "intern") redirect("/equipment"); const equipment = await listActiveEquipmentOptions(await createClient(), business.id); const id = Number((await searchParams).equipmentId); return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Record service, cost, meter reading, and the next due interval." title="Add maintenance" /><MaintenanceForm equipment={equipment} selectedId={Number.isInteger(id) ? id : undefined} today={dateInTimeZone(business.timezone)} /></div>; }
