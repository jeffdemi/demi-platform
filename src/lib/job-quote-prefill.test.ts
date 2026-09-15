import { describe, expect, it } from "vitest";
import { jobDefaultsFromQuote, quotesForCustomer, type JobQuotePrefill } from "./job-quote-prefill";

const acceptedQuote: JobQuotePrefill = {
  id: 41,
  customer_id: 7,
  quote_number: "Q-2026-0041",
  status: "accepted",
  service_address: "12 Oak Lane",
  property_location: "back_yard",
  location_description: "Behind the shed",
  referral_source: "Neighbor",
  customer_scope: "Remove two maple stumps",
  hazard_notes: "Fence nearby",
  quoted_price: 625,
  pro_bono: false,
  pa811_required: true,
  acceptance_notes: "Customer prefers a Friday.",
  internal_notes: "Bring the narrow gate setup.",
};

describe("job quote prefill", () => {
  it("maps every compatible quote field into editable job defaults", () => {
    expect(jobDefaultsFromQuote(acceptedQuote)).toEqual({
      customerId: 7,
      status: "quoted",
      serviceAddress: "12 Oak Lane",
      propertyLocation: "back_yard",
      locationDescription: "Behind the shed",
      referralSource: "Neighbor",
      workDescription: "Remove two maple stumps",
      hazardNotes: "Fence nearby",
      amountQuoted: "625",
      proBono: false,
      pa811Required: true,
      notes: "Customer prefers a Friday.\n\nBring the narrow gate setup.",
    });
  });

  it("filters quote choices after a customer is selected", () => {
    const otherQuote = { ...acceptedQuote, id: 42, customer_id: 9 };
    expect(quotesForCustomer([acceptedQuote, otherQuote], null)).toHaveLength(2);
    expect(quotesForCustomer([acceptedQuote, otherQuote], 7)).toEqual([acceptedQuote]);
  });

  it("does not treat a pending zero price as a quoted job amount", () => {
    const pendingPrice = { ...acceptedQuote, quoted_price: 0, acceptance_notes: null, internal_notes: null };
    expect(jobDefaultsFromQuote(pendingPrice).amountQuoted).toBe("");
    expect(jobDefaultsFromQuote(pendingPrice).notes).toBe("");
  });
});
