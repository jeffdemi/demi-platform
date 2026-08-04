import { apiBusinessContext } from "@/lib/api-auth";
import { buildReportSummary } from "@/lib/domain/reports";
import { getReportData } from "@/lib/repositories/reporting-repository";

export async function GET(request: Request) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ data: buildReportSummary(await getReportData(context.client, context.businessId)) });
}
