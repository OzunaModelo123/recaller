import type Stripe from "stripe";

/** Invoice + legacy/expanded subscription field (shape varies by Stripe API version). */
type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

/**
 * Resolves subscription id from an Invoice for payment_failed (and similar) handlers.
 * Stripe API shapes vary by version; we try several known locations.
 */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as InvoiceWithSubscription).subscription;
  if (typeof direct === "string" && direct.length > 0) return direct;
  if (direct && typeof direct === "object" && "id" in direct && typeof direct.id === "string") {
    return direct.id;
  }

  const nested =
    invoice.parent?.subscription_details?.subscription ??
    (invoice as Stripe.Invoice & {
      subscription_details?: { subscription?: string | Stripe.Subscription };
    }).subscription_details?.subscription;

  if (typeof nested === "string" && nested.length > 0) return nested;
  if (nested && typeof nested === "object" && "id" in nested && typeof nested.id === "string") {
    return nested.id;
  }

  return null;
}
