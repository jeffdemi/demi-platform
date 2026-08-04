import { apiBusinessContext } from "@/lib/api-auth";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { getQuote } from "@/lib/repositories/quote-repository";
import { buildQuotePdf } from "@/lib/services/pdf";

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const context = await apiBusinessContext(request);
  if (!context) return new Response("Unauthorized", { status: 401 });
  const id = Number((await params).quoteId);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [quote, business] = await Promise.all([
    getQuote(context.client, context.businessId, id),
    getBusinessDocumentDetails(context.client, context.businessId),
  ]);
  if (!quote) return new Response("Not found", { status: 404 });
  const bytes = await buildQuotePdf(business, quote);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"` } });
}
