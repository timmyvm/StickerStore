import { NextResponse } from "next/server";
import { confirmPeptideCardOrderPaid } from "@/app/lib/peptide-orders";
import {
  retrieveStripeCheckoutSession,
  verifyStripeWebhookSignature,
} from "@/app/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook: the authoritative "payment happened" signal. The success
 * redirect (/api/card-checkout/verify) covers the buyer who lands back here;
 * this covers the buyer who closes the tab first. Both confirm through the
 * same idempotent peptide-store endpoint, so whichever arrives second is a
 * no-op there.
 */

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(rawBody) as { type?: string; data?: { object?: { id?: string } } };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const sessionId = event.data?.object?.id;
    if (!sessionId) {
      console.error("[stripe-webhook] checkout.session.completed without session id");
      return NextResponse.json({ received: true });
    }
    try {
      // Re-read the session from Stripe: the webhook's own payload shape varies
      // by API version, and the signed event has already told us it exists.
      const session = await retrieveStripeCheckoutSession(sessionId);
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }
      const orderNumber =
        session.client_reference_id ?? session.metadata?.orderNumber ?? null;
      if (!orderNumber) {
        console.error("[stripe-webhook] paid session has no order reference", sessionId);
        return NextResponse.json({ received: true });
      }
      await confirmPeptideCardOrderPaid(orderNumber, session.payment_intent ?? session.id);
    } catch (error) {
      // 500 makes Stripe retry; the confirm is idempotent, so a retry is safe.
      console.error("[stripe-webhook] confirm failed", error);
      return NextResponse.json({ error: "Confirmation failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
