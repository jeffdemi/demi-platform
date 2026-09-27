import { describe, expect, it } from "vitest";
import { customerAddressLine } from "./domain/customers";

describe("customerAddressLine", () => {
  it("joins street, city, state, and zip into one line", () => {
    expect(customerAddressLine({ street_address: "12 Oak Lane", city: "Springfield", state: "PA", zip: "19064" }))
      .toBe("12 Oak Lane, Springfield, PA 19064");
  });

  it("omits parts that are not set", () => {
    expect(customerAddressLine({ street_address: "12 Oak Lane", city: null, state: null, zip: null })).toBe("12 Oak Lane");
    expect(customerAddressLine({ street_address: null, city: "Springfield", state: "PA", zip: null })).toBe("Springfield, PA");
  });

  it("returns an empty string when nothing is set", () => {
    expect(customerAddressLine({ street_address: null, city: null, state: null, zip: null })).toBe("");
  });
});
