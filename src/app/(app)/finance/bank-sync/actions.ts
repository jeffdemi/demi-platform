"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessContext } from "@/lib/auth";
import { confirmBankSyncRun, listBankConnections, saveBankAccountMappings } from "@/lib/repositories/bank-sync-repository";
import {
  buildBankSyncPreview,
  connectSimpleFinSetupToken,
  disconnectSimpleFinConnection,
  refreshSimpleFinAccounts,
} from "@/lib/services/bank-sync-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();
const setupTokenSchema = z.string().trim().min(20).max(4096);

export type BankSyncActionState = {
  message?: string;
  success?: boolean;
  runId?: string;
};

function ensureAdministrator(role: "owner" | "admin" | "employee") {
  if (role === "employee") throw new Error("Only an owner or administrator can manage bank connections.");
}

export async function connectSimpleFin(
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  const parsed = setupTokenSchema.safeParse(formData.get("setupToken"));
  if (!parsed.success) return { message: "Paste the complete SimpleFIN Setup Token." };
  try {
    const result = await connectSimpleFinSetupToken({
      client: await createClient(),
      admin: createAdminClient(),
      businessId: context.business.id,
      userId: context.user.id,
      setupToken: parsed.data,
    });
    revalidatePath("/finance/bank-sync");
    return {
      success: true,
      message: `SimpleFIN connected securely. ${result.accountCount} accounts were found; map each business account below.`,
    };
  } catch (error) {
    revalidatePath("/finance/bank-sync");
    return { message: error instanceof Error ? error.message : "SimpleFIN could not be connected." };
  }
}

export async function refreshConnectionAccounts(
  connectionId: string,
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  void formData;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  const parsedConnectionId = idSchema.safeParse(connectionId);
  if (!parsedConnectionId.success) return { message: "The bank connection is invalid." };
  try {
    const result = await refreshSimpleFinAccounts({
      client: await createClient(),
      admin: createAdminClient(),
      businessId: context.business.id,
      connectionId: parsedConnectionId.data,
    });
    revalidatePath("/finance/bank-sync");
    return {
      success: true,
      message: `${result.accountCount} SimpleFIN accounts refreshed${result.warnings.length ? " with provider warnings" : ""}.`,
    };
  } catch (error) {
    revalidatePath("/finance/bank-sync");
    return { message: error instanceof Error ? error.message : "The SimpleFIN account list could not be refreshed." };
  }
}

export async function saveConnectionMappings(
  connectionId: string,
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  const parsedConnectionId = idSchema.safeParse(connectionId);
  if (!parsedConnectionId.success) return { message: "The bank connection is invalid." };
  try {
    const client = await createClient();
    const connections = await listBankConnections(client, context.business.id);
    const connection = connections.find((candidate) => candidate.id === parsedConnectionId.data);
    if (!connection) return { message: "The bank connection is no longer available." };
    const mappings = connection.bank_connection_accounts.map((account) => {
      const raw = String(formData.get(`mapping_${account.id}`) || "");
      const bankAccountId = raw ? Number(raw) : null;
      if (bankAccountId !== null && (!Number.isInteger(bankAccountId) || bankAccountId <= 0)) {
        throw new Error(`Select a valid mapping for ${account.provider_account_name}.`);
      }
      return { connectionAccountId: account.id, bankAccountId };
    });
    const selectedIds = mappings.flatMap((mapping) => mapping.bankAccountId === null ? [] : [mapping.bankAccountId]);
    if (new Set(selectedIds).size !== selectedIds.length) return { message: "Each business account can be mapped only once." };
    await saveBankAccountMappings(client, context.business.id, parsedConnectionId.data, mappings);
    revalidatePath("/finance/bank-sync");
    return { success: true, message: "Account mappings saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The account mappings could not be saved." };
  }
}

export async function previewLatestBankActivity(
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  void formData;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  try {
    const runId = await buildBankSyncPreview({
      client: await createClient(),
      admin: createAdminClient(),
      businessId: context.business.id,
      userId: context.user.id,
    });
    revalidatePath("/finance/bank-sync");
    return { success: true, runId, message: "Preview ready. Review it before importing anything." };
  } catch (error) {
    revalidatePath("/finance/bank-sync");
    return { message: error instanceof Error ? error.message : "The latest bank activity could not be loaded." };
  }
}

export async function confirmLatestBankActivity(
  runId: string,
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  void formData;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  const parsedRunId = idSchema.safeParse(runId);
  if (!parsedRunId.success) return { message: "The bank preview is invalid." };
  try {
    await confirmBankSyncRun(await createClient(), context.business.id, parsedRunId.data);
    revalidatePath("/finance");
    revalidatePath("/finance/bank-sync");
    revalidatePath(`/finance/bank-sync/${parsedRunId.data}`);
    return { success: true, message: "Bank activity imported. Existing CSV rows were linked and new posted rows were added once." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The bank activity could not be imported." };
  }
}

export async function disconnectConnection(
  connectionId: string,
  previousState: BankSyncActionState,
  formData: FormData,
): Promise<BankSyncActionState> {
  void previousState;
  const context = await requireBusinessContext();
  ensureAdministrator(context.role);
  const parsedConnectionId = idSchema.safeParse(connectionId);
  if (!parsedConnectionId.success || formData.get("confirm") !== "yes") {
    return { message: "Confirm that you want to disconnect SimpleFIN." };
  }
  try {
    await disconnectSimpleFinConnection({
      client: await createClient(),
      admin: createAdminClient(),
      businessId: context.business.id,
      connectionId: parsedConnectionId.data,
    });
    revalidatePath("/finance/bank-sync");
    return { success: true, message: "The saved SimpleFIN credential was removed. Imported transactions remain; revoke the app under SimpleFIN My Account too." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "SimpleFIN could not be disconnected." };
  }
}
