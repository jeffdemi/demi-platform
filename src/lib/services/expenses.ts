import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createExpense, getActiveRefundTotal, getExpense, updateExpense } from "@/lib/repositories/expense-repository";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type ExpenseInput = Omit<Database["public"]["Tables"]["expenses"]["Insert"], "business_id" | "receipt_path">;

const receiptTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);
const receiptBucket = "expense-receipts";
const maximumReceiptBytes = 4 * 1024 * 1024;

function receiptFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > maximumReceiptBytes) throw new Error("Receipt files must be 4 MB or smaller.");
  const extension = receiptTypes.get(value.type);
  if (!extension) throw new Error("Receipts must be a JPG, PNG, WebP, or PDF file.");
  return { file: value, extension };
}

async function uploadReceipt(client: Client, businessId: number, value: FormDataEntryValue | null) {
  const receipt = receiptFile(value);
  if (!receipt) return null;
  const path = `${businessId}/${randomUUID()}.${receipt.extension}`;
  const bytes = await receipt.file.arrayBuffer();
  const result = await client.storage.from(receiptBucket).upload(path, bytes, {
    contentType: receipt.file.type,
    upsert: false,
  });
  if (result.error) throw new Error(`Unable to upload receipt: ${result.error.message}`);
  return path;
}

async function removeReceipt(client: Client, path: string | null) {
  if (!path) return;
  await client.storage.from(receiptBucket).remove([path]);
}

async function validateRefundSource(client: Client, businessId: number, input: ExpenseInput, excludeExpenseId?: number) {
  if (input.transaction_type !== "refund") return;
  if (!input.refund_of_expense_id) throw new Error("Select the original expense for this refund.");
  const source = await getExpense(client, businessId, input.refund_of_expense_id);
  if (!source || source.voided_at || source.transaction_type === "refund") {
    throw new Error("The original expense is unavailable for a refund.");
  }
  const alreadyRefunded = await getActiveRefundTotal(client, businessId, source.id, excludeExpenseId);
  if (alreadyRefunded + input.amount > source.amount) {
    const remaining = Math.max(0, source.amount - alreadyRefunded).toFixed(2);
    throw new Error(`This refund exceeds the $${remaining} remaining refundable amount.`);
  }
}

export async function createExpenseRecord(
  client: Client,
  businessId: number,
  input: ExpenseInput,
  receiptValue: FormDataEntryValue | null,
) {
  await validateRefundSource(client, businessId, input);
  const receiptPath = await uploadReceipt(client, businessId, receiptValue);
  try {
    return await createExpense(client, { ...input, business_id: businessId, receipt_path: receiptPath });
  } catch (error) {
    await removeReceipt(client, receiptPath);
    throw error;
  }
}

export async function updateExpenseRecord(
  client: Client,
  businessId: number,
  expenseId: number,
  input: ExpenseInput,
  receiptValue: FormDataEntryValue | null,
) {
  const existing = await getExpense(client, businessId, expenseId);
  if (!existing) return null;
  await validateRefundSource(client, businessId, input, expenseId);
  const replacementPath = await uploadReceipt(client, businessId, receiptValue);
  try {
    const updated = await updateExpense(client, businessId, expenseId, {
      ...input,
      ...(replacementPath ? { receipt_path: replacementPath } : {}),
    });
    if (updated && replacementPath) await removeReceipt(client, existing.receipt_path);
    return updated;
  } catch (error) {
    await removeReceipt(client, replacementPath);
    throw error;
  }
}

export async function createReceiptUrl(client: Client, path: string | null) {
  if (!path) return null;
  const result = await client.storage.from(receiptBucket).createSignedUrl(path, 300);
  if (result.error) throw new Error(`Unable to open receipt: ${result.error.message}`);
  return result.data.signedUrl;
}
