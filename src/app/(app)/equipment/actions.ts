"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { addMaintenance, createEquipment, getEquipment, updateEquipmentFinancials } from "@/lib/repositories/equipment-repository";
import { createClient } from "@/lib/supabase/server";
import { equipmentFinancialsSchema, equipmentFormSchema, formValues, maintenanceFormSchema } from "@/lib/validation/business-records";
export type EquipmentState = { message?: string; errors?: Record<string, string[]> };
export async function saveEquipment(_: EquipmentState, formData: FormData): Promise<EquipmentState> { const parsed = equipmentFormSchema.safeParse({ ...formValues(formData, ["name", "equipmentType", "makeModel", "serialNumber", "hourMeter", "notes"]), active: formData.get("active") === "on" }); if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }; const { business } = await requireBusinessContext(); try { await createEquipment(await createClient(), { business_id: business.id, name: parsed.data.name, equipment_type: parsed.data.equipmentType ?? null, make_model: parsed.data.makeModel ?? null, serial_number: parsed.data.serialNumber ?? null, hour_meter: parsed.data.hourMeter ?? null, active: parsed.data.active, notes: parsed.data.notes ?? null }); revalidatePath("/equipment"); redirect("/equipment"); } catch (error) { if (error && typeof error === "object" && "digest" in error) throw error; return { message: "The equipment could not be saved." }; } }
export async function saveMaintenance(_: EquipmentState, formData: FormData): Promise<EquipmentState> { const parsed = maintenanceFormSchema.safeParse(formValues(formData, ["equipmentId", "serviceDate", "serviceType", "hourMeter", "cost", "nextDueDate", "nextDueHours", "notes"])); if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }; if (!parsed.data.equipmentId || !parsed.data.serviceDate) return { message: "Equipment and service date are required." }; const { business } = await requireBusinessContext(); try { await addMaintenance(await createClient(), { businessId: business.id, ...parsed.data, equipmentId: parsed.data.equipmentId, serviceDate: parsed.data.serviceDate }); revalidatePath("/equipment"); revalidatePath("/dashboard"); redirect("/equipment"); } catch (error) { if (error && typeof error === "object" && "digest" in error) throw error; return { message: "The maintenance record could not be saved." }; } }

export async function saveEquipmentFinancials(equipmentId: number, _: EquipmentState, formData: FormData): Promise<EquipmentState> {
  const parsed = equipmentFinancialsSchema.safeParse(formValues(formData, [
    "purchaseDate", "inServiceDate", "purchaseCost", "salvageValue", "usefulLifeMonths",
    "depreciationMethod", "loanLender", "loanOriginalAmount", "loanBalance", "loanInterestRate", "loanMaturityDate",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can change equipment financials." };
  const client = await createClient();
  if (!(await getEquipment(client, context.business.id, equipmentId))) return { message: "That equipment no longer exists." };
  try {
    await updateEquipmentFinancials(client, context.business.id, equipmentId, {
      purchase_date: parsed.data.purchaseDate ?? null,
      in_service_date: parsed.data.inServiceDate ?? null,
      purchase_cost: parsed.data.purchaseCost ?? null,
      salvage_value: parsed.data.salvageValue ?? 0,
      useful_life_months: parsed.data.usefulLifeMonths ?? null,
      depreciation_method: parsed.data.depreciationMethod ?? null,
      loan_lender: parsed.data.loanLender ?? null,
      loan_original_amount: parsed.data.loanOriginalAmount ?? null,
      loan_balance: parsed.data.loanBalance ?? null,
      loan_interest_rate: parsed.data.loanInterestRate ?? null,
      loan_maturity_date: parsed.data.loanMaturityDate ?? null,
    });
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${equipmentId}/financials`);
    revalidatePath("/reports");
    revalidatePath("/finance/month-end");
    return { message: "Equipment financials saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Equipment financials could not be saved." };
  }
}
