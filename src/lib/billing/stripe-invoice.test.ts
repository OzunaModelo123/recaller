import { describe, expect, it } from "vitest";
import { subscriptionIdFromInvoice } from "./stripe-invoice";

describe("subscriptionIdFromInvoice", () => {
  it("reads string subscription id", () => {
    const inv = { subscription: "sub_123" } as Parameters<typeof subscriptionIdFromInvoice>[0];
    expect(subscriptionIdFromInvoice(inv)).toBe("sub_123");
  });

  it("reads expanded subscription object id", () => {
    const inv = {
      subscription: { id: "sub_expanded", object: "subscription" },
    } as Parameters<typeof subscriptionIdFromInvoice>[0];
    expect(subscriptionIdFromInvoice(inv)).toBe("sub_expanded");
  });

  it("reads parent.subscription_details.subscription string", () => {
    const inv = {
      subscription: null,
      parent: {
        subscription_details: { subscription: "sub_nested" },
      },
    } as Parameters<typeof subscriptionIdFromInvoice>[0];
    expect(subscriptionIdFromInvoice(inv)).toBe("sub_nested");
  });

  it("returns null when missing", () => {
    const inv = {} as Parameters<typeof subscriptionIdFromInvoice>[0];
    expect(subscriptionIdFromInvoice(inv)).toBe(null);
  });
});
