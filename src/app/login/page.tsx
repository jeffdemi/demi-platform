import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-[#f4f6f3] lg:grid-cols-[minmax(360px,0.78fr)_1.22fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 text-[#16372c]">
            <span className="grid size-11 place-items-center rounded-md bg-[#16372c] text-white">
              <TreePine aria-hidden="true" size={24} strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-lg font-bold">Demi Platform</p>
              <p className="text-sm text-[#66716b]">Demi Solutions LLC</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-[#1e2421]">Welcome back</h1>
          <p className="mt-2 text-base leading-7 text-[#66716b]">
            Sign in to manage today&apos;s work.
          </p>
          <LoginForm />
          <p className="mt-8 text-sm text-[#76817b]">Authorized team members only.</p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-[#16372c] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-x-0 top-0 h-2 bg-[#c9972b]" />
        <div className="relative max-w-xl pb-8">
          <p className="text-sm font-semibold uppercase text-[#d8b562]">Daily operations</p>
          <p className="mt-4 text-4xl font-semibold leading-tight">
            Customers, jobs, quotes, and equipment in one dependable place.
          </p>
        </div>
      </aside>
    </main>
  );
}
