import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { safeNextPath } from "@/lib/urls";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: setupAvailable } = await supabase.rpc("platform_setup_available");

  if (data?.claims) {
    redirect(nextPath);
  }

  return (
    <main className="grid min-h-screen bg-page lg:grid-cols-[minmax(360px,0.78fr)_1.22fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 text-brand">
            <span className="grid size-11 place-items-center rounded-md bg-brand text-on-brand">
              <TreePine aria-hidden="true" size={24} strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-lg font-bold">Demi Platform</p>
              <p className="text-sm text-muted">Demi Solutions LLC</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
          <p className="mt-2 text-base leading-7 text-muted">
            Sign in to manage today&apos;s work.
          </p>
          <LoginForm nextPath={nextPath} />
          <p className="mt-8 text-sm text-muted-subtle">Authorized team members only.</p>
          {setupAvailable && (
            <Link className="mt-3 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/setup">
              Create the first owner account
            </Link>
          )}
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-brand p-12 text-on-brand lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-x-0 top-0 h-2 bg-accent" />
        <div className="relative max-w-xl pb-8">
          <p className="text-sm font-semibold uppercase text-accent">Daily operations</p>
          <p className="mt-4 text-4xl font-semibold leading-tight">
            Customers, jobs, quotes, and equipment in one dependable place.
          </p>
        </div>
      </aside>
    </main>
  );
}
