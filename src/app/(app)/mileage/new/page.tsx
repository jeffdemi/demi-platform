import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { normalizeMileageSettings } from "@/lib/domain/mileage";
import { getMileageSettings } from "@/lib/repositories/mileage-repository";
import { createClient } from "@/lib/supabase/server";
import { ManualMileageTripForm } from "./form";

export const metadata: Metadata = { title: "Add mileage trip" };

export default async function NewMileageTripPage() {
  const context = await requireBusinessContext();
  if (context.role === "intern") redirect("/mileage");
  const client = await createClient();
  const settings = normalizeMileageSettings(await getMileageSettings(client, context.business.id));
  if (!settings.home_base_address) redirect("/mileage");

  return <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description="For business driving that isn't tied to a job -- supply runs, parts pickups, and the like." title="Add manual trip" />
    <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <ManualMileageTripForm homeBaseAddress={settings.home_base_address} today={dateInTimeZone(context.business.timezone)} />
    </section>
  </div>;
}
