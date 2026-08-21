export type BusinessMembership = {
  id: number;
  name: string;
  timezone: string;
  role: "owner" | "admin" | "employee" | "intern";
};

export function resolveActiveBusiness(
  memberships: BusinessMembership[],
  requestedBusinessId: number | null,
): BusinessMembership {
  if (!memberships.length) {
    throw new Error("No business memberships available.");
  }

  const requested = requestedBusinessId !== null
    ? memberships.find((membership) => membership.id === requestedBusinessId)
    : undefined;

  return requested ?? memberships[0];
}
