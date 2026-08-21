"use client";

import type { BusinessMembership } from "@/lib/domain/business-membership";

export function BusinessSwitcher({
  action,
  activeBusinessId,
  memberships,
}: {
  action: (formData: FormData) => void;
  activeBusinessId: number;
  memberships: BusinessMembership[];
}) {
  return (
    <form action={action} className="flex items-center gap-2 border-t border-white/10 px-4 py-3 lg:px-5">
      <label className="sr-only" htmlFor="businessId">Active business</label>
      <select
        className="h-10 min-w-0 flex-1 rounded-md border border-white/20 bg-brand px-2 text-sm text-on-brand"
        defaultValue={activeBusinessId}
        id="businessId"
        name="businessId"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {memberships.map((membership) => (
          <option className="text-body" key={membership.id} value={membership.id}>{membership.name}</option>
        ))}
      </select>
    </form>
  );
}
