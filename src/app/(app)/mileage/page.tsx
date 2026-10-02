import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { normalizeMileageSettings } from "@/lib/domain/mileage";
import { getMileageSettings, listPendingMileageTrips } from "@/lib/repositories/mileage-repository";
import { createClient } from "@/lib/supabase/server";
import { MileageApprovalForm } from "./approval-form";
import { GenerateSuggestionsButton } from "./generate-button";
import { MileageSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Mileage" };

export default async function MileagePage() {
  const context = await requireBusinessContext();
  const client = await createClient();
  const settings = normalizeMileageSettings(await getMileageSettings(client, context.business.id));

  if (!settings.home_base_address) {
    return <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader description="Suggests mileage log entries from your job addresses and dates automatically." title="Mileage" />
      <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-bold">Set your home base address to get started</h2>
        <p className="mt-1 text-sm leading-6 text-muted">This is where your vehicle starts and ends every day. Once it&apos;s set, trips are suggested automatically from your existing job addresses and dates -- nothing else to type.</p>
        <div className="mt-4"><MileageSettingsForm homeBaseAddress={settings.home_base_address} irsStandardMileageRate={settings.irs_standard_mileage_rate} /></div>
      </section>
    </div>;
  }

  const trips = await listPendingMileageTrips(client, context.business.id);

  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<>
      <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold hover:bg-surface-muted" href="/mileage/new"><FilePlus2 size={16} />Add manual trip</Link>
      <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong" href="/mileage/report">Yearly report<ArrowRight size={16} /></Link>
    </>} description="Suggests mileage log entries from your job addresses and dates automatically. Approving a trip never touches your bookkeeping." title="Mileage" />

    <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-bold">Settings</h2>
      <div className="mt-4"><MileageSettingsForm homeBaseAddress={settings.home_base_address} irsStandardMileageRate={settings.irs_standard_mileage_rate} /></div>
    </section>

    <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{trips.length} trip{trips.length === 1 ? "" : "s"} awaiting review</h2>
        <GenerateSuggestionsButton />
      </div>
      <div className="mt-4"><MileageApprovalForm key={trips.map((trip) => trip.id).join("-")} trips={trips} /></div>
    </section>
  </div>;
}
