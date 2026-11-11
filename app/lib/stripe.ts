import "server-only";

import crypto from "crypto";

/**
 * Minimal Stripe REST client — checkout sessions only, over plain fetch.
 * Deliberately no Stripe SDK dependency: the hosted Checkout page does the card
 * work, so this app only ever creates a session, reads one back, and verifies
 * webhook signatures (HMAC-SHA256, same scheme the SDK uses).
 */

const STRIPE_API = "https://api.stripe.com/v1";

const getSecretKey = () => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Stripe is not configured: set STRIPE_SECRET_KEY.");
  }
  return key;
};

/** Form-encoded POST; params are already flat Stripe keys (a[b] style). */
const stripePost = async (path: string, params: Record<string, string>) => {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Stripe request failed (${response.status}).`);
  }
  return payload;
};

export type StripeCheckoutSession = {
  id: string;
  payment_status?: string;
  payment_intent?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

export type CreateCheckoutSessionInput = {
  /** Order total in the currency's smallest unit (cents). */
  amountMinor: number;
  currency: string;
  orderNumber: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
};

export const createStripeCheckoutSession = async (
  input: CreateCheckoutSessionInput
): Promise<{ id: string; url: string }> => {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Card checkout total must be a positive amount.");
  }
  const params: Record<string, string> = {
    mode: "payment",
    // Cards only (Apple Pay / Google Pay ride on this). Without it Stripe can
    // offer delayed methods such as direct debit, which complete "unpaid" and
    // would leave the order waiting with nothing here to confirm it later.
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountMinor),
    "line_items[0][price_data][product_data][name]": `Order ${input.orderNumber}`,
    "line_items[0][price_data][product_data][description]":
      "Payment for your order (goods dispatched on confirmation).",
    client_reference_id: input.orderNumber,
    "metadata[orderNumber]": input.orderNumber,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
  if (input.customerEmail) {
    params.customer_email = input.customerEmail;
  }
  const session = await stripePost("/checkout/sessions", params) as {
    id: string;
    url: string;
  };
  if (!session.id || !session.url) {
    throw new Error("Stripe did not return a checkout session URL.");
  }
  return { id: session.id, url: session.url };
};

export const retrieveStripeCheckoutSession = async (
  sessionId: string
): Promise<StripeCheckoutSession> => {
  const response = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & StripeCheckoutSession;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Stripe session lookup failed (${response.status}).`);
  }
  return payload;
};

/**
 * Verifies a stripe-signature header ("t=...,v1=...") against the raw request
 * body, the same way the Stripe SDK does. Returns false on any mismatch,
 * stale timestamp, or missing secret — callers treat that as unauthoritative.
 */
export const verifyStripeWebhookSignature = (
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300
): boolean => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || value === undefined) return acc;
    (acc[key.trim()] ??= []).push(value.trim());
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "utf8");
    return (
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  });
};
