import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type Maintenance = Database["public"]["Tables"]["maintenance"]["Row"];
export type EquipmentWithMaintenance = Database["public"]["Tables"]["equipment"]["Row"] & { maintenance: Maintenance[] };

export async function listEquipment(client: Client, businessId: number) {
  const result = await client.from("equipment").select("*, maintenance(*)").eq("business_id", businessId).order("active", { ascending: false }).order("name");
  if (result.error) throw new Error(`Unable to load equipment: ${result.error.message}`);
  return (result.data as EquipmentWithMaintenance[]).map((item) => ({ ...item, maintenance: item.maintenance.sort((a, b) => b.service_date.localeCompare(a.service_date)) }));
}

export async function createEquipment(client: Client, values: Database["public"]["Tables"]["equipment"]["Insert"]) {
  const result = await client.from("equipment").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to create equipment: ${result.error.message}`);
  return result.data;
}

export async function getEquipment(client: Client, businessId: number, equipmentId: number) {
  const result = await client.from("equipment").select("*")
    .eq("business_id", businessId).eq("id", equipmentId).maybeSingle();
  if (result.error) throw new Error(`Unable to load equipment: ${result.error.message}`);
  return result.data;
}

export async function updateEquipmentFinancials(
  client: Client,
  businessId: number,
  equipmentId: number,
  values: Database["public"]["Tables"]["equipment"]["Update"],
) {
  const result = await client.from("equipment").update(values)
    .eq("business_id", businessId).eq("id", equipmentId).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to save equipment financials: ${result.error.message}`);
  return result.data;
}

export async function addMaintenance(client: Client, values: {
  businessId: number; equipmentId: number; serviceDate: string; serviceType: string; hourMeter?: number;
  cost?: number; nextDueDate?: string; nextDueHours?: number; notes?: string;
}) {
  const result = await client.rpc("add_maintenance_record", {
    target_business_id: values.businessId, target_equipment_id: values.equipmentId,
    serviced_on: values.serviceDate, maintenance_type: values.serviceType, meter_hours: values.hourMeter,
    maintenance_cost: values.cost, due_on: values.nextDueDate, due_hours: values.nextDueHours, maintenance_notes: values.notes,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listActiveEquipmentOptions(client: Client, businessId: number) {
  const result = await client.from("equipment").select("id, name").eq("business_id", businessId).eq("active", true).order("name");
  if (result.error) throw new Error(`Unable to load equipment: ${result.error.message}`);
  return result.data;
}
