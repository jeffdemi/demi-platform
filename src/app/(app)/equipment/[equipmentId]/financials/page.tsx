import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { equipmentDepreciationForPeriod } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import { getEquipment } from "@/lib/repositories/equipment-repository";
import { createClient } from "@/lib/supabase/server";
import { EquipmentFinancialForm } from "./equipment-financial-form";

export const metadata: Metadata = { title: "Equipment Financials" };

export default async function EquipmentFinancialsPage({ params }: { params: Promise<{ equipmentId: string }> }) {
  const equipmentId = Number((await params).equipmentId);
  if (!Number.isInteger(equipmentId)) notFound();
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) redirect("/equipment");
  const equipment = await getEquipment(await createClient(), context.business.id, equipmentId);
  if (!equipment) notFound();
  const today = dateInTimeZone(context.business.timezone);
  const accumulatedDepreciation = equipment.in_service_date
    ? equipmentDepreciationForPeriod(equipment, equipment.in_service_date, today)
    : 0;
  const estimatedBookValue = Math.max(equipment.salvage_value ?? 0, (equipment.purchase_cost ?? 0) - accumulatedDepreciation);
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description="Management estimates for capital, depreciation, and loan reporting. Confirm tax depreciation with your CPA." title={`${equipment.name} Financials`} />
    <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Purchase cost", formatCurrency(equipment.purchase_cost)], ["Accumulated depreciation", formatCurrency(accumulatedDepreciation)], ["Estimated book value", formatCurrency(estimatedBookValue)], ["Loan balance", formatCurrency(equipment.loan_balance)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4" key={label}><p className="text-lg font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <EquipmentFinancialForm equipment={equipment} equipmentId={equipment.id} />
  </div>;
}
