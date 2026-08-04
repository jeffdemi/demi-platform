import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listJobImports } from "@/lib/repositories/import-repository";
import { createClient } from "@/lib/supabase/server";
import { ImportWorkflow } from "./import-workflow";
export const metadata: Metadata = { title: "Import jobs" };
export default async function ImportJobsPage() { const { business } = await requireBusinessContext(); const history = await listJobImports(await createClient(), business.id); return <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Preview spreadsheet rows before creating customers and jobs. Re-importing the same file is safe." title="Import jobs" /><ImportWorkflow />{history.length > 0 && <section className="mt-8 border-t border-line pt-6"><h2 className="font-bold">Recent imports</h2><div className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">{history.map((item) => <div className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_180px_150px]" key={item.id}><span className="font-semibold">{item.file_name}</span><span>{item.jobs_created} jobs created</span><time className="text-muted">{new Date(item.created_at).toLocaleString()}</time></div>)}</div></section>}</div>; }
