import type { Metadata } from "next";
import { Suspense } from "react";
import { CardCheckoutClient } from "@/app/components/card-checkout/CardCheckoutClient";

export const metadata: Metadata = {
  title: "Pay by card",
  robots: { index: false, follow: false },
};

/**
 * Card-checkout handoff page. Peptide-store orders paid by card land here as
 * /A=order?A-123456 (the peptide store's redirect template); the order
 * summary is fetched server-to-server from that store, and payment runs on a
 * Stripe-hosted page.
 */
export default function CardOrderPage() {
  return (
    <Suspense fallback={null}>
      <CardCheckoutClient />
    </Suspense>
  );
}
