import type { Metadata } from "next";
import { requireBusinessContext } from "@/lib/auth";
import { CreateBusinessForm } from "./create-business-form";

export const metadata: Metadata = { title: "Businesses" };

export default async function BusinessesPage() {
  const context = await requireBusinessContext();

  return (
    <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
      <header className="border-b border-line pb-5">
        <p className="text-sm font-semibold text-muted">Account access</p>
        <h1 className="mt-1 text-2xl font-bold">Businesses</h1>
      </header>

      <section className="border-b border-line py-7">
        <h2 className="text-lg font-bold">Your businesses</h2>
        <p className="mt-1 text-sm text-muted">Use the switcher in the sidebar to move between businesses you belong to.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
          <div className="divide-y divide-line">
            {context.memberships.map((membership) => (
              <div className="flex items-center justify-between px-4 py-4" key={membership.id}>
                <p className="font-semibold">{membership.name}</p>
                <p className="text-sm capitalize text-muted">
                  {membership.role}
                  {membership.id === context.business.id ? " · Current" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {context.role === "owner" && (
        <section className="py-7">
          <h2 className="text-lg font-bold">Add another business</h2>
          <p className="mt-1 text-sm text-muted">Creates a new, fully separate business workspace that you own. Invite different people into each business from its own Team page.</p>
          <CreateBusinessForm />
        </section>
      )}
    </div>
  );
}
