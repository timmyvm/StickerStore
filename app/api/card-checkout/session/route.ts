import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/app/lib/rate-limit";
import { CARD_CHECKOUT_PATH } from "@/app/lib/card-checkout";
import {
  fetchPeptideCardOrder,
  normalizePeptideOrderNumber,
  toCardOrderSummary,
} from "@/app/lib/peptide-orders";
import { createStripeCheckoutSession } from "@/app/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Card checkout for peptide-store orders: the /A=order page posts an order
 * number here, we fetch the payable summary from the peptide store (the price
 * never travels through the browser) and hand back a Stripe Checkout URL.
 *
 * Order numbers are guessable, so neither handler returns the buyer's email
 * or the signed order-status link (toCardOrderSummary strips both). The
 * status link is only returned by /verify, after Stripe confirms payment.
 */

const ORDER_UNAVAILABLE = "We couldn't load this order. Please try again.";

const resolveOrigin = (request: Request) =>
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  new URL(request.url).origin;

/** GET — order summary for the pay page. No Stripe call, no side effects. */
export async function GET(request: Request) {
  const limited = rateLimit(`card-summary:${getClientIp(request)}`, 30, 10 * 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const orderNumber = normalizePeptideOrderNumber(
    new URL(request.url).searchParams.get("order") ?? ""
  );
  if (!orderNumber) {
    return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
  }
  // Signed link factor — forwarded, never verified here (the peptide store owns
  // the secret; it returns state "invalid_link" without it where it matters).
  const cardToken = new URL(request.url).searchParams.get("t")?.trim() ?? "";

  try {
    const summary = toCardOrderSummary(await fetchPeptideCardOrder(orderNumber, cardToken));
    if (!summary) {
      console.error("[card-checkout] payable order has no usable total/currency", orderNumber);
      return NextResponse.json({ error: ORDER_UNAVAILABLE }, { status: 500 });
    }
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[card-checkout] summary failed", error);
    return NextResponse.json({ error: ORDER_UNAVAILABLE }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(`card-session:${getClientIp(request)}`, 10, 10 * 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: { orderNumber?: unknown; t?: unknown };
  try {
    body = (await request.json()) as { orderNumber?: unknown; t?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const orderNumber =
    typeof body.orderNumber === "string" ? normalizePeptideOrderNumber(body.orderNumber) : null;
  // Signed link factor from the pay page URL — kept in the Stripe return URLs
  // so the buyer can retry after Back/cancel without a fresh link.
  const cardToken = typeof body.t === "string" ? body.t.trim() : "";
  if (!orderNumber) {
    return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
  }

  try {
    const order = await fetchPeptideCardOrder(orderNumber, cardToken);
    const summary = toCardOrderSummary(order);
    if (!summary) {
      console.error("[card-checkout] payable order has no usable total/currency", orderNumber);
      return NextResponse.json({ error: "Order total is unavailable." }, { status: 500 });
    }
    if (summary.state !== "payable") {
      return NextResponse.json({ state: summary.state });
    }

    // Charge exactly the total the pay page showed: the same narrowed summary.
    const origin = resolveOrigin(request);
    const payPage = `${origin}${CARD_CHECKOUT_PATH}?order=${encodeURIComponent(orderNumber)}${
      cardToken ? `&t=${encodeURIComponent(cardToken)}` : ""
    }`;
    const session = await createStripeCheckoutSession({
      amountMinor: Math.round(summary.total * 100),
      currency: summary.currency,
      orderNumber,
      customerEmail: order.customerEmail ?? null,
      successUrl: `${payPage}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: payPage,
    });

    return NextResponse.json({ state: "payable", checkoutUrl: session.url });
  } catch (error) {
    console.error("[card-checkout] session failed", error);
    return NextResponse.json(
      { error: "We couldn't start card payment. Please try again." },
      { status: 500 }
    );
  }
}
