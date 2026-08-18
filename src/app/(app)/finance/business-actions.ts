"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { normalizeDigitalAssetRows, parseCsv } from "@/lib/domain/digital-assets";
import {
  assignBusinessLine, createCleanupItem, createDigitalAssetAccount, importDigitalAssetTransactions, postCleanupItem,
  recordCapitalTransaction, saveBusinessIdentity, saveDigitalAssetReconciliation,
} from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";
import { businessIdentitySchema, businessLineAssignmentSchema, capitalTransactionSchema, cleanupItemSchema, digitalAssetAccountSchema, digitalAssetImportSchema, digitalAssetReconciliationSchema, formValues } from "@/lib/validation/business-records";

export type BusinessFinanceState = { message?: string; success?: boolean; errors?: Record<string, string[]> };

async function adminContext() {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) throw new Error("Only an owner or administrator can change bookkeeping controls.");
  return context;
}

export async function addDigitalAssetAccount(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = digitalAssetAccountSchema.safeParse(formValues(formData, ["name", "provider", "accountType", "externalReference"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const context = await adminContext();
    await createDigitalAssetAccount(await createClient(), {
      business_id: context.business.id, name: parsed.data.name, provider: parsed.data.provider,
      account_type: parsed.data.accountType, external_reference: parsed.data.externalReference,
    });
    revalidatePath("/finance/digital-assets");
    return { success: true, message: "Digital asset account added." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The account could not be added." }; }
}

export async function importDigitalAssetCsv(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = digitalAssetImportSchema.safeParse({ accountId: formData.get("accountId") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { errors: { file: ["Choose an exchange CSV export."] } };
  if (file.size > 10 * 1024 * 1024) return { errors: { file: ["The CSV must be 10 MB or smaller."] } };
  try {
    const context = await adminContext();
    const bytes = Buffer.from(await file.arrayBuffer());
    const normalized = normalizeDigitalAssetRows(parseCsv(bytes.toString("utf8")));
    if (normalized.errors.length) return { message: normalized.errors.slice(0, 8).join(" ") };
    if (!normalized.rows.length) return { message: "The CSV contained no transaction rows." };
    const result = await importDigitalAssetTransactions(await createClient(), {
      businessId: context.business.id, accountId: parsed.data.accountId!, fileName: file.name,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"), rows: normalized.rows,
    });
    revalidatePath("/finance/digital-assets");
    return { success: true, message: result.already_imported ? "This exact exchange file was already imported." : `Imported ${result.created} rows; skipped ${result.skipped} duplicates.` };
  } catch (error) { return { message: error instanceof Error ? error.message : "The exchange CSV could not be imported." }; }
}

export async function reconcileDigitalAssetAccount(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = digitalAssetReconciliationSchema.safeParse(formValues(formData, ["accountId", "asOfDate", "balances", "reportedCashUsd", "notes"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const balances: Record<string, number> = {};
  for (const part of parsed.data.balances.split(/[\n,]+/)) {
    const [symbol, rawUnits] = part.split(":").map((value) => value.trim());
    const units = Number(rawUnits);
    if (!/^[A-Za-z0-9]{2,12}$/.test(symbol ?? "") || !Number.isFinite(units) || units < 0) return { errors: { balances: ["Use SYMBOL: units pairs, such as BTC: 0.25, ETH: 2."] } };
    balances[symbol.toUpperCase()] = units;
  }
  try {
    const context = await adminContext();
    await saveDigitalAssetReconciliation(await createClient(), { business_id: context.business.id, account_id: parsed.data.accountId!, as_of_date: parsed.data.asOfDate!, reported_balances: balances, reported_cash_usd: parsed.data.reportedCashUsd ?? 0, notes: parsed.data.notes, status: "reconciled", reconciled_at: new Date().toISOString(), reconciled_by: context.user.id });
    revalidatePath("/finance/digital-assets");
    return { success: true, message: "Exchange balances reconciled as reported." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The reconciliation could not be saved." }; }
}

export async function classifyRecord(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = businessLineAssignmentSchema.safeParse(formValues(formData, ["recordType", "recordId", "businessLineId"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const context = await adminContext();
    await assignBusinessLine(await createClient(), { businessId: context.business.id, recordType: parsed.data.recordType, recordId: parsed.data.recordId!, businessLineId: parsed.data.businessLineId! });
    revalidatePath("/finance/classification"); revalidatePath("/reports/books");
    return { success: true, message: "Business line updated." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The classification could not be saved." }; }
}

export async function addCapitalTransaction(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = capitalTransactionSchema.safeParse(formValues(formData, ["businessLineId", "bankAccountId", "transactionDate", "transactionType", "amount", "counterparty", "memo"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const context = await adminContext();
    await recordCapitalTransaction(await createClient(), { businessId: context.business.id, ...parsed.data, transactionDate: parsed.data.transactionDate!, amount: parsed.data.amount! });
    revalidatePath("/finance/capital"); revalidatePath("/reports/books");
    return { success: true, message: parsed.data.transactionType === "owner_draw" ? "Owner draw recorded outside expenses." : "Owner activity recorded and posted." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The owner activity could not be recorded." }; }
}

export async function updateBusinessIdentity(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = businessIdentitySchema.safeParse(formValues(formData, ["legalName", "publicBrand", "taxTreatment", "fictitiousNameStatus", "fictitiousNameJurisdiction", "notes"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const context = await adminContext();
    await saveBusinessIdentity(await createClient(), {
      business_id: context.business.id, legal_name: parsed.data.legalName, public_brand: parsed.data.publicBrand,
      tax_treatment: parsed.data.taxTreatment, fictitious_name_status: parsed.data.fictitiousNameStatus,
      fictitious_name_jurisdiction: parsed.data.fictitiousNameJurisdiction, notes: parsed.data.notes, updated_by: context.user.id,
    });
    revalidatePath("/finance/business-settings");
    return { success: true, message: "Legal identity and public brand settings saved." };
  } catch (error) { return { message: error instanceof Error ? error.message : "Business identity could not be saved." }; }
}

export async function addCleanupItem(_: BusinessFinanceState, formData: FormData): Promise<BusinessFinanceState> {
  const parsed = cleanupItemSchema.safeParse(formValues(formData, ["businessLineId", "itemType", "effectiveDate", "description", "amount", "debitAccountId", "creditAccountId", "resolutionNotes"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const context = await adminContext();
    await createCleanupItem(await createClient(), {
      business_id: context.business.id, business_line_id: parsed.data.businessLineId, item_type: parsed.data.itemType,
      effective_date: parsed.data.effectiveDate!, description: parsed.data.description, amount: parsed.data.amount,
      debit_account_id: parsed.data.debitAccountId, credit_account_id: parsed.data.creditAccountId,
      resolution_notes: parsed.data.resolutionNotes, created_by: context.user.id,
    });
    revalidatePath("/finance/cleanup");
    return { success: true, message: "Cleanup item added without changing posted books." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The cleanup item could not be added." }; }
}

export async function postHistoricalCleanupItem(itemId: number, previousState: BusinessFinanceState): Promise<BusinessFinanceState> {
  void previousState;
  try {
    const context = await adminContext();
    await postCleanupItem(await createClient(), context.business.id, itemId);
    revalidatePath("/finance/cleanup"); revalidatePath("/reports/books");
    return { success: true, message: "Opening balance posted as a balanced journal entry." };
  } catch (error) { return { message: error instanceof Error ? error.message : "The cleanup item could not be posted." }; }
}
