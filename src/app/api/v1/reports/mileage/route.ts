import { apiBusinessContext, csvResponse } from "@/lib/api-auth";
import { buildMileageReportRows, type MileageLeg } from "@/lib/domain/mileage";
import { listApprovedMileageTripsForYear } from "@/lib/repositories/mileage-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const requestedYear = Number(query.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : Number(today.slice(0, 4));

  const trips = await listApprovedMileageTripsForYear(context.client, context.businessId, year);
  const rows = buildMileageReportRows(trips.map((trip) => ({ trip_date: trip.trip_date, purpose: trip.purpose, legs: trip.legs as MileageLeg[] })));
  return csvResponse(rows.map((row) => ({ date: row.date, origin: row.origin, destination: row.destination, purpose: row.purpose, miles: row.miles })), `mileage-${year}.csv`);
}
