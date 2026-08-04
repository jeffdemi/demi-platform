import { apiBusinessContext } from "@/lib/api-auth";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { getInvoice } from "@/lib/repositories/invoice-repository";
import { buildInvoicePdf } from "@/lib/services/pdf";

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const context = await apiBusinessContext(request);
  if (!context) return new Response("Unauthorized", { status: 401 });
  const id = Number((await params).invoiceId);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [invoice, business] = await Promise.all([
    getInvoice(context.client, context.businessId, id),
    getBusinessDocumentDetails(context.client, context.businessId),
  ]);
  if (!invoice) return new Response("Not found", { status: 404 });
  const bytes = await buildInvoicePdf(business, invoice);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"` } });
}
