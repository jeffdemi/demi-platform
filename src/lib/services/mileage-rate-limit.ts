import "server-only";

// Nominatim's usage policy caps lookups at 1 request/second. Every geocode and
// distance pair is cached forever (see mileage-distance.ts), so only the first
// lookup for a given address/pair ever calls out -- this in-process throttle is
// what keeps a single "Generate now" run compliant without any cross-request
// coordination.
let lastCallAt = 0;
const MIN_INTERVAL_MS = 1100;

export async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const waitMs = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastCallAt = Date.now();
  return fn();
}
