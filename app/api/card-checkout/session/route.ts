import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/app/lib/rate-limit";
import {
  fetchPeptideCardOrder,
  normalizePeptideOrderNumber,
} from "@/app/lib/peptide-orders";
import { createStripeCheckoutSession } from "@/app/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Card checkout for peptide-store orders: the /A=order page posts an order
 * number here, we fetch the payable summary from the peptide store (the price
 * never travels through the browser) and hand back a Stripe Checkout URL.
 */

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

  try {
    const order = await fetchPeptideCardOrder(orderNumber);
    return NextResponse.json(order);
  } catch (error) {
    console.error("[card-checkout] summary failed", error);
    return NextResponse.json(
      { error: "We couldn't load this order. Please try again." },
      { status: 500 }
    );
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

  let body: { orderNumber?: unknown };
  try {
    body = (await request.json()) as { orderNumber?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const orderNumber =
    typeof body.orderNumber === "string" ? normalizePeptideOrderNumber(body.orderNumber) : null;
  if (!orderNumber) {
    return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
  }

  try {
    const order = await fetchPeptideCardOrder(orderNumber);
    if (order.state !== "payable") {
      return NextResponse.json({ state: order.state, orderStatusUrl: order.orderStatusUrl });
    }
    if (typeof order.total !== "number" || !order.currency) {
      return NextResponse.json({ error: "Order total is unavailable." }, { status: 500 });
    }

    const origin = resolveOrigin(request);
    const session = await createStripeCheckoutSession({
      amountMinor: Math.round(order.total * 100),
      currency: order.currency,
      orderNumber,
      customerEmail: order.customerEmail ?? null,
      successUrl: `${origin}/A=order?order=${encodeURIComponent(orderNumber)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/A=order?order=${encodeURIComponent(orderNumber)}`,
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
