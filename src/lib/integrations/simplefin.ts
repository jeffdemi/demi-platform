import { z } from "zod";
import type { BankProviderTransaction } from "../domain/bank-sync";
import type { Json } from "../../types/database";

const allowedHosts = new Set(["bridge.simplefin.org", "beta-bridge.simplefin.org"]);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

const simpleFinErrorSchema = z.object({
  code: z.string().catch("gen."),
  msg: z.string().catch("SimpleFIN reported an unknown error."),
  conn_id: z.string().optional(),
  account_id: z.string().optional(),
}).passthrough();

const connectionSchema = z.object({
  conn_id: z.string().min(1),
  name: z.string().min(1),
  org_id: z.string().min(1),
  org_name: z.string().optional(),
  org_url: z.string().optional(),
  sfin_url: z.string().optional(),
}).passthrough();

const transactionSchema = z.object({
  id: z.string().min(1),
  posted: z.coerce.number().int().nonnegative(),
  amount: z.union([z.string(), z.number()]),
  description: z.string(),
  transacted_at: z.coerce.number().int().nonnegative().optional(),
  pending: z.boolean().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  conn_id: z.string().min(1),
  conn_name: z.string().optional(),
  currency: z.string().min(1),
  balance: z.union([z.string(), z.number()]),
  "available-balance": z.union([z.string(), z.number()]).optional(),
  "balance-date": z.coerce.number().int().nonnegative(),
  transactions: z.array(transactionSchema).optional().default([]),
  extra: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const accountSetSchema = z.object({
  errlist: z.array(simpleFinErrorSchema).optional().default([]),
  errors: z.array(z.string()).optional().default([]),
  connections: z.array(connectionSchema).optional().default([]),
  accounts: z.array(accountSchema).optional().default([]),
});

export type SimpleFinConnection = z.infer<typeof connectionSchema>;
export type SimpleFinAccount = z.infer<typeof accountSchema>;
export type SimpleFinAccountSet = z.infer<typeof accountSetSchema>;

export class SimpleFinApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function safeMessage(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function validateHost(url: URL) {
  if (url.protocol !== "https:" || url.port || !allowedHosts.has(url.hostname)) {
    throw new Error("The SimpleFIN token points to an unexpected server.");
  }
}

export function decodeSimpleFinSetupToken(setupToken: string) {
  const compact = setupToken.trim();
  if (!compact || compact.length > 4096 || /\s/.test(compact)) {
    throw new Error("Paste the complete SimpleFIN Setup Token.");
  }
  let decoded: string;
  try {
    decoded = Buffer.from(compact, "base64url").toString("utf8");
  } catch {
    throw new Error("The SimpleFIN Setup Token is not valid Base64.");
  }
  if (!decoded.startsWith("https://")) throw new Error("The SimpleFIN Setup Token is invalid.");
  const url = new URL(decoded);
  validateHost(url);
  if (url.username || url.password || url.search || url.hash || !url.pathname.startsWith("/simplefin/claim/")) {
    throw new Error("The SimpleFIN Setup Token has an unexpected format.");
  }
  return url;
}

export function validateSimpleFinAccessUrl(value: string) {
  const url = new URL(value.trim());
  validateHost(url);
  if (!url.username || !url.password || url.search || url.hash || url.pathname.replace(/\/$/, "") !== "/simplefin") {
    throw new Error("SimpleFIN returned an invalid Access URL.");
  }
  return url;
}

async function responseText(response: Response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new SimpleFinApiError("SimpleFIN returned too much data.", 502);
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) throw new SimpleFinApiError("SimpleFIN returned too much data.", 502);
  return body;
}

async function simpleFinFetch(url: URL, init: RequestInit) {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof SimpleFinApiError) throw error;
    throw new SimpleFinApiError("SimpleFIN could not be reached. Try again in a few minutes.", 503);
  }
}

export async function claimSimpleFinSetupToken(setupToken: string) {
  const claimUrl = decodeSimpleFinSetupToken(setupToken);
  const response = await simpleFinFetch(claimUrl, { method: "POST", headers: { "content-length": "0" } });
  const body = (await responseText(response)).trim();
  if (response.status === 403) {
    throw new SimpleFinApiError("This Setup Token has expired or was already claimed. Disable it in SimpleFIN, create a new token, and try again.", 403);
  }
  if (!response.ok) throw new SimpleFinApiError("SimpleFIN could not claim this Setup Token. Create a new token and try again.", response.status);
  return validateSimpleFinAccessUrl(body).toString();
}

function authenticatedAccountsUrl(accessUrlValue: string, options: {
  startDate?: string;
  endDateExclusive?: string;
  balancesOnly?: boolean;
  includePending?: boolean;
}) {
  const accessUrl = validateSimpleFinAccessUrl(accessUrlValue);
  const username = decodeURIComponent(accessUrl.username);
  const password = decodeURIComponent(accessUrl.password);
  accessUrl.username = "";
  accessUrl.password = "";
  accessUrl.pathname = `${accessUrl.pathname.replace(/\/$/, "")}/accounts`;
  accessUrl.searchParams.set("version", "2");
  if (options.startDate) accessUrl.searchParams.set("start-date", String(Date.parse(`${options.startDate}T00:00:00Z`) / 1000));
  if (options.endDateExclusive) accessUrl.searchParams.set("end-date", String(Date.parse(`${options.endDateExclusive}T00:00:00Z`) / 1000));
  if (options.balancesOnly) accessUrl.searchParams.set("balances-only", "1");
  if (options.includePending) accessUrl.searchParams.set("pending", "1");
  return { url: accessUrl, authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
}

export async function getSimpleFinAccountSet(accessUrl: string, options: {
  startDate?: string;
  endDateExclusive?: string;
  balancesOnly?: boolean;
  includePending?: boolean;
} = {}) {
  const request = authenticatedAccountsUrl(accessUrl, options);
  const response = await simpleFinFetch(request.url, { headers: { accept: "application/json", authorization: request.authorization } });
  if (response.status === 402) throw new SimpleFinApiError("SimpleFIN billing needs attention before account activity can refresh.", 402);
  if (response.status === 403) throw new SimpleFinApiError("SimpleFIN access was disabled or expired. Create a new Setup Token to reconnect.", 403);
  if (!response.ok) throw new SimpleFinApiError("SimpleFIN could not refresh account activity. Try again later.", response.status);
  const body = await responseText(response);
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { throw new SimpleFinApiError("SimpleFIN returned an unreadable response.", 502); }
  const result = accountSetSchema.safeParse(parsed);
  if (!result.success) throw new SimpleFinApiError("SimpleFIN returned account data in an unsupported format.", 502);
  return result.data;
}

export function simpleFinWarnings(accountSet: SimpleFinAccountSet) {
  return [
    ...accountSet.errlist.map((error) => safeMessage(`${error.code}: ${error.msg}`)),
    ...accountSet.errors.map(safeMessage),
  ].filter(Boolean);
}

function isoDateFromEpoch(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}

export function simpleFinTransactions(account: SimpleFinAccount): BankProviderTransaction[] {
  const fallbackDate = new Date().toISOString().slice(0, 10);
  return account.transactions.map((transaction) => {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.0000001) {
      throw new SimpleFinApiError(`SimpleFIN returned an invalid amount for ${safeMessage(transaction.description)}.`, 502);
    }
    const postedDate = transaction.posted > 0 ? isoDateFromEpoch(transaction.posted) : null;
    const transactionDate = transaction.transacted_at && transaction.transacted_at > 0
      ? isoDateFromEpoch(transaction.transacted_at)
      : postedDate ?? fallbackDate;
    return {
      id: transaction.id,
      transactionDate,
      postedDate,
      description: safeMessage(transaction.description) || "Bank transaction",
      amount,
      status: transaction.pending || transaction.posted === 0 ? "pending" : "posted",
      type: "simplefin",
      currency: account.currency,
      metadata: jsonValue({
        simplefin_account_id: account.id,
        simplefin_connection_id: account.conn_id,
        simplefin_posted: transaction.posted,
        simplefin_transacted_at: transaction.transacted_at ?? null,
        simplefin_pending: transaction.pending ?? false,
        simplefin_extra: transaction.extra ?? {},
      }),
    };
  });
}
