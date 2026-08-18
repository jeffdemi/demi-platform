"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordRemovalSchema } from "@/lib/validation/business-records";

export type RemovableRecordType = "job" | "quote" | "invoice" | "expense";
export type RecordLifecycleState = { message?: string; success?: boolean };

const paths: Record<RemovableRecordType, { list: string; detail: (id: number) => string }> = {
  job: { list: "/jobs", detail: (id) => `/jobs/${id}` },
  quote: { list: "/quotes", detail: (id) => `/quotes/${id}` },
  invoice: { list: "/invoices", detail: (id) => `/invoices/${id}` },
  expense: { list: "/expenses", detail: (id) => `/expenses/${id}` },
};

function refreshRecord(type: RemovableRecordType, id: number) {
  revalidatePath(paths[type].list);
  revalidatePath(paths[type].detail(id));
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/finance");
}

export async function changeRecordLifecycle(
  type: RemovableRecordType,
  id: number,
  _: RecordLifecycleState,
  formData: FormData,
): Promise<RecordLifecycleState> {
  const parsed = recordRemovalSchema.safeParse({ intent: formData.get("intent"), reason: formData.get("reason") ?? undefined, confirm: formData.get("confirm") ?? undefined, overrideConfirmation: formData.get("overrideConfirmation") ?? undefined });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Review the removal request." };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can remove records." };
  const client = await createClient();
  const { intent, reason } = parsed.data;

  try {
    if (intent === "archive" || intent === "restore") {
      const restoring = intent === "restore";
      const values = restoring
        ? { archived_at: null, archived_by: null, archive_reason: null }
        : { archived_at: new Date().toISOString(), archived_by: context.user.id, archive_reason: reason };
      const result = type === "expense"
        ? await client.from("expenses").update(restoring
          ? { voided_at: null, voided_by: null, void_reason: null }
          : { voided_at: new Date().toISOString(), voided_by: context.user.id, void_reason: reason })
          .eq("business_id", context.business.id).eq("id", id).select("id").maybeSingle()
        : type === "job"
          ? await client.from("jobs").update(values).eq("business_id", context.business.id).eq("id", id).select("id").maybeSingle()
          : type === "quote"
            ? await client.from("quotes").update(values).eq("business_id", context.business.id).eq("id", id).select("id").maybeSingle()
            : await client.from("invoices").update(values).eq("business_id", context.business.id).eq("id", id).select("id").maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) return { message: "That record no longer exists." };
      refreshRecord(type, id);
      return { success: true, message: restoring ? "Record restored." : "Record archived and removed from normal lists." };
    }

    if (intent === "force_delete") {
      const storageRemovals: Array<{ bucket: string; paths: string[] }> = [];
      if (type === "quote") {
        const photos = await client.from("quote_photos").select("storage_path").eq("business_id", context.business.id).eq("quote_id", id);
        if (photos.error) throw new Error(photos.error.message);
        storageRemovals.push({ bucket: "quote-photos", paths: (photos.data ?? []).map((photo) => photo.storage_path) });
      } else if (type === "expense") {
        const receipts = await client.from("expenses").select("receipt_path").eq("business_id", context.business.id).or(`id.eq.${id},refund_of_expense_id.eq.${id}`);
        if (receipts.error) throw new Error(receipts.error.message);
        storageRemovals.push({ bucket: "expense-receipts", paths: (receipts.data ?? []).flatMap((expense) => expense.receipt_path ? [expense.receipt_path] : []) });
      } else if (type === "job") {
        const jobExpenses = await client.from("expenses").select("id, receipt_path").eq("business_id", context.business.id).eq("job_id", id);
        if (jobExpenses.error) throw new Error(jobExpenses.error.message);
        const expenseIds = (jobExpenses.data ?? []).map((expense) => expense.id);
        const refunds = expenseIds.length > 0
          ? await client.from("expenses").select("receipt_path").eq("business_id", context.business.id).in("refund_of_expense_id", expenseIds)
          : { data: [], error: null };
        if (refunds.error) throw new Error(refunds.error.message);
        const paths = [...(jobExpenses.data ?? []), ...(refunds.data ?? [])].flatMap((expense) => expense.receipt_path ? [expense.receipt_path] : []);
        storageRemovals.push({ bucket: "expense-receipts", paths });
      }
      for (const removal of storageRemovals) {
        if (removal.paths.length === 0) continue;
        const storageResult = await client.storage.from(removal.bucket).remove(removal.paths);
        if (storageResult.error) throw new Error(`Unable to remove attached files: ${storageResult.error.message}`);
      }
      const override = await client.rpc("force_delete_business_record", {
        target_business_id: context.business.id,
        target_record_type: type,
        target_record_id: id,
        deletion_reason: reason ?? "Override deletion",
      });
      if (override.error) throw new Error(override.error.message);
      refreshRecord(type, id);
      redirect(paths[type].list);
    }

    if (type === "quote") {
      const [record, photos, jobs] = await Promise.all([
        client.from("quotes").select("status, job_id").eq("business_id", context.business.id).eq("id", id).maybeSingle(),
        client.from("quote_photos").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("quote_id", id),
        client.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("quote_id", id),
      ]);
      if (!record.data) return { message: "That quote no longer exists." };
      if (record.data.status !== "draft" || record.data.job_id || photos.count || jobs.count) return { message: "This quote has been sent, converted, or has attached records. Archive it instead." };
    } else if (type === "job") {
      const checks = await Promise.all([
        client.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("job_id", id),
        client.from("expenses").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("job_id", id),
        client.from("payments").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("job_id", id),
        client.from("labor_entries").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("job_id", id),
        client.from("quotes").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("job_id", id),
      ]);
      if (checks.some((check) => check.error)) throw new Error("Unable to verify the job dependencies.");
      if (checks.some((check) => (check.count ?? 0) > 0)) return { message: "This job has linked quotes, invoices, expenses, payments, or labor. Archive it instead." };
    } else if (type === "invoice") {
      const [record, payments] = await Promise.all([
        client.from("invoices").select("status").eq("business_id", context.business.id).eq("id", id).maybeSingle(),
        client.from("payments").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("invoice_id", id),
      ]);
      if (!record.data) return { message: "That invoice no longer exists." };
      if (record.data.status !== "draft" || payments.count) return { message: "Only an unpaid draft with no payments can be permanently deleted. Archive or void this invoice instead." };
    } else {
      const [record, refunds, journals] = await Promise.all([
        client.from("expenses").select("bank_transaction_id, receipt_path").eq("business_id", context.business.id).eq("id", id).maybeSingle(),
        client.from("expenses").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("refund_of_expense_id", id),
        client.from("journal_entries").select("id", { count: "exact", head: true }).eq("business_id", context.business.id).eq("source_type", "expense").eq("source_id", id),
      ]);
      if (!record.data) return { message: "That expense no longer exists." };
      if (record.data.bank_transaction_id || record.data.receipt_path || refunds.count || journals.count) return { message: "This expense has a bank match, receipt, refund, or ledger activity. Archive it instead." };
    }

    const deletion = type === "job"
      ? await client.from("jobs").delete().eq("business_id", context.business.id).eq("id", id)
      : type === "quote"
        ? await client.from("quotes").delete().eq("business_id", context.business.id).eq("id", id)
        : type === "invoice"
          ? await client.from("invoices").delete().eq("business_id", context.business.id).eq("id", id)
          : await client.from("expenses").delete().eq("business_id", context.business.id).eq("id", id);
    if (deletion.error) throw new Error(deletion.error.message);
    refreshRecord(type, id);
    redirect(paths[type].list);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The record could not be removed." };
  }
}
