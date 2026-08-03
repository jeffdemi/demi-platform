import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, CircleDollarSign, FileText, Users } from "lucide-react";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { business } = await requireBusinessContext();
  const supabase = await createClient();
  const today = dateInTimeZone(business.timezone);

  const [customers, activeJobs, openQuotes, unpaidInvoices, todaysJobs] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", business.id).not("status", "in", "(paid,cancelled)"),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("business_id", business.id).in("status", ["draft", "sent", "accepted", "no_response"]),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "unpaid"),
    supabase.from("jobs").select("id, scheduled_start_time, work_description, customers(first_name, last_name, company_name)").eq("business_id", business.id).eq("scheduled_date", today).order("scheduled_start_time").limit(6),
  ]);

  const metrics = [
    { label: "Active customers", value: customers.count ?? 0, icon: Users, href: "/customers" },
    { label: "Active jobs", value: activeJobs.count ?? 0, icon: BriefcaseBusiness, href: "/jobs" },
    { label: "Open quotes", value: openQuotes.count ?? 0, icon: FileText, href: null },
    { label: "Unpaid invoices", value: unpaidInvoices.count ?? 0, icon: CircleDollarSign, href: null },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="border-b border-line pb-5">
        <div>
          <p className="text-sm font-semibold text-muted">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Daily operations</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 py-6 xl:grid-cols-4" aria-label="Business summary">
        {metrics.map(({ label, value, icon: Icon, href }) => {
          const content = <>
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-brand-soft text-brand"><Icon aria-hidden="true" size={19} /></span>
            </div>
            <p className="mt-5 text-3xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </>;
          return href ? <Link className="rounded-lg border border-line bg-surface p-4 shadow-sm hover:border-brand-border hover:bg-page sm:p-5" href={href} key={label}>{content}</Link> : <div className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5" key={label}>{content}</div>;
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <CalendarDays aria-hidden="true" className="text-brand" size={20} />
              <h2 className="font-bold">Today&apos;s jobs</h2>
            </div>
          </div>
          {todaysJobs.data?.length ? (
            <div className="divide-y divide-line">
              {todaysJobs.data.map((job) => (
                <Link className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-page" href={`/jobs/${job.id}`} key={job.id}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{job.work_description || "Scheduled job"}</p>
                    <p className="mt-1 text-sm text-muted">{job.scheduled_start_time ? formatTime(job.scheduled_start_time) : "Time not set"}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold">No jobs scheduled today</p>
              <p className="mt-1 text-sm text-muted">The day is clear.</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-accent-soft p-5 shadow-sm">
          <p className="text-sm font-semibold text-warning-ink">Attention</p>
          <h2 className="mt-2 text-xl font-bold">Keep work moving</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-md border border-accent-line bg-surface px-4 py-3 text-sm font-semibold">Open quotes <span className="tabular-nums">{openQuotes.count ?? 0}</span></div>
            <div className="flex items-center justify-between rounded-md border border-accent-line bg-surface px-4 py-3 text-sm font-semibold">
              Unpaid invoices <span className="tabular-nums">{unpaidInvoices.count ?? 0}</span>
            </div>
            <Link className="flex items-center justify-between rounded-md border border-accent-line bg-surface px-4 py-3 text-sm font-semibold hover:border-brand-border" href="/jobs">Active jobs <span className="tabular-nums">{activeJobs.count ?? 0}</span></Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Job views">
        <Link className="rounded-lg border border-line bg-surface p-4 font-semibold shadow-sm hover:border-brand-border hover:bg-page" href="/jobs?view=today">Today&apos;s jobs</Link>
        <Link className="rounded-lg border border-line bg-surface p-4 font-semibold shadow-sm hover:border-brand-border hover:bg-page" href="/jobs?view=upcoming">Upcoming jobs</Link>
        <Link className="rounded-lg border border-line bg-surface p-4 font-semibold shadow-sm hover:border-brand-border hover:bg-page" href="/jobs?view=unscheduled">Unscheduled jobs</Link>
        <Link className="rounded-lg border border-line bg-surface p-4 font-semibold shadow-sm hover:border-brand-border hover:bg-page" href="/jobs?view=completed">Completed jobs</Link>
      </section>
    </div>
  );
}
