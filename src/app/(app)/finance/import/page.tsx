import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listBankAccounts } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { BankImportWorkflow } from "./import-workflow";

export const metadata: Metadata = { title: "Import bank statement" };

export default async function ImportBankStatementPage() {
  const { business } = await requireBusinessContext();
  const accounts = await listBankAccounts(await createClient(), business.id);
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Preview every row before adding statement transactions. Re-importing the same file is safe." title="Import bank statement" /><BankImportWorkflow accounts={accounts.filter((account) => account.active).map(({ id, name }) => ({ id, name }))} /></div>;
}
