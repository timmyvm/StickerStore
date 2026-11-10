import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/app/lib/rate-limit";
import { confirmPeptideCardOrderPaid } from "@/app/lib/peptide-orders";
import { retrieveStripeCheckoutSession } from "@/app/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Success-return leg of card checkout: the browser comes back from Stripe with
 * a session id. We ask Stripe whether it actually paid (never the browser),
 * then tell the peptide store, which runs its idempotent confirm flow. The
 * webhook (/api/webhooks/stripe) does the same for buyers who close the tab
 * before the redirect lands.
 */

export async function POST(request: Request) {
  const limited = rateLimit(`card-verify:${getClientIp(request)}`, 20, 10 * 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: { sessionId?: unknown };
  try {
    body = (await request.json()) as { sessionId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim().startsWith("cs_")
      ? body.sessionId.trim()
      : null;
  if (!sessionId) {
    return NextResponse.json({ error: "Invalid payment session." }, { status: 400 });
  }

  try {
    const session = await retrieveStripeCheckoutSession(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ state: "unpaid" });
    }

    const orderNumber =
      session.client_reference_id ?? session.metadata?.orderNumber ?? null;
    if (!orderNumber) {
      console.error("[card-checkout] paid session has no order reference", sessionId);
      return NextResponse.json(
        { error: "We couldn't match this payment to an order. Contact support." },
        { status: 500 }
      );
    }

    const paymentRef = session.payment_intent ?? session.id;
    const result = await confirmPeptideCardOrderPaid(orderNumber, paymentRef);
    return NextResponse.json({
      state: "paid",
      orderNumber: result.orderNumber ?? orderNumber,
      orderStatusUrl: result.orderStatusUrl ?? null,
    });
  } catch (error) {
    console.error("[card-checkout] verify failed", error);
    return NextResponse.json(
      { error: "We couldn't verify your payment. Please try again." },
      { status: 500 }
    );
  }
}
