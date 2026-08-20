export const dashboardRangeOptions = [
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "year_to_date", label: "Year to date" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom range" },
] as const;

function shiftDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function resolveDashboardRange(today: string, range?: string, from?: string, to?: string) {
  const selected = dashboardRangeOptions.some((option) => option.value === range) ? range! : "this_month";
  if (selected === "all_time") return { selected, start: null, end: null, label: "All time" };
  if (selected === "last_30_days") return { selected, start: shiftDays(today, -29), end: today, label: "Last 30 days" };
  if (selected === "year_to_date") return { selected, start: `${today.slice(0, 4)}-01-01`, end: today, label: "Year to date" };
  if (selected === "custom") {
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : today;
    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : today;
    const [start, end] = validFrom <= validTo ? [validFrom, validTo] : [validTo, validFrom];
    return { selected, start, end, label: `${start} to ${end}` };
  }
  return { selected, start: `${today.slice(0, 7)}-01`, end: today, label: "This month" };
}
