"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

type SummaryResponse = {
  ok?: boolean;
  state?: "payable" | "already_paid" | "cancelled" | "not_card" | "not_found";
  orderNumber?: string;
  items?: Array<{ name: string; variant: string; quantity: number; lineTotal: number }>;
  subtotal?: number;
  discountAmount?: number;
  discountCode?: string | null;
  voucherCodes?: Array<{ code: string; value: number }>;
  voucherTotal?: number;
  shippingCost?: number;
  signatureFee?: number;
  total?: number;
  currency?: string;
  orderStatusUrl?: string | null;
  error?: string;
};

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "summary"; order: SummaryResponse }
  | { kind: "paying" }
  | { kind: "paid"; orderStatusUrl: string | null; orderNumber: string | null };

/** Formats in the peptide order's currency (AUD/USD/EUR — not just AUD like this store's own checkout). */
const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: ["AUD", "USD", "EUR"].includes(currency) ? currency : "AUD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/**
 * The peptide store links here as /A=order?A-123456 — a bare query value —
 * but ?order=A-123456 is accepted too.
 */
const readOrderNumber = (params: URLSearchParams): string | null => {
  const explicit = params.get("order") ?? params.get("A") ?? null;
  if (explicit) return explicit;
  for (const key of params.keys()) {
    if (/^A-?\d{6}$/i.test(key)) return key;
  }
  return null;
};

export const CardCheckoutClient = () => {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const pendingRef = useRef(false);

  /** Success return from Stripe: verify with Stripe, then confirm the order. */
  useEffect(() => {
    if (!sessionId) return;
    let isActive = true;
    (async () => {
      try {
        const response = await fetch("/api/card-checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          state?: string;
          orderStatusUrl?: string | null;
          orderNumber?: string;
          error?: string;
        };
        if (!isActive) return;
        if (response.ok && payload.state === "paid") {
          setPhase({
            kind: "paid",
            orderStatusUrl: payload.orderStatusUrl ?? null,
            orderNumber: payload.orderNumber ?? null,
          });
          return;
        }
        // Not paid yet (e.g. the buyer backed out of the Stripe page) — show
        // the pay view again so they can retry.
        setPhase({ kind: "error", message: payload.error ?? "Payment isn't complete yet — you can try again below." });
      } catch {
        if (isActive) {
          setPhase({ kind: "error", message: "We couldn't verify your payment. Please try again." });
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [sessionId]);

  /** Load the order summary for display. */
  const orderNumber = readOrderNumber(searchParams);
  useEffect(() => {
    if (sessionId || !orderNumber) return;
    let isActive = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/card-checkout/session?order=${encodeURIComponent(orderNumber)}`
        );
        const payload = (await response.json().catch(() => ({}))) as SummaryResponse;
        if (!isActive) return;
        if (response.ok && payload.state) {
          setPhase({ kind: "summary", order: payload });
          return;
        }
        setPhase({ kind: "error", message: payload.error ?? "We couldn't load this order." });
      } catch {
        if (isActive) {
          setPhase({ kind: "error", message: "We couldn't reach the payment service. Check your connection and try again." });
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [orderNumber, sessionId]);

  const handlePay = useCallback(async () => {
    if (pendingRef.current || !orderNumber) return;
    pendingRef.current = true;
    setPhase({ kind: "paying" });
    try {
      const response = await fetch("/api/card-checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        state?: string;
        checkoutUrl?: string;
        orderStatusUrl?: string;
        error?: string;
      };
      if (response.ok && payload.state === "payable" && payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return; // Keep the button locked while Stripe loads.
      }
      if (response.ok && payload.state === "already_paid" && payload.orderStatusUrl) {
        window.location.assign(payload.orderStatusUrl);
        return;
      }
      setPhase({
        kind: "error",
        message: payload.error ?? "We couldn't start card payment. Please try again.",
      });
    } catch {
      setPhase({ kind: "error", message: "We couldn't reach the payment service. Check your connection and try again." });
    }
    pendingRef.current = false;
  }, [orderNumber]);

  return renderView({ phase, orderNumber, onPay: handlePay });
};

type ViewProps = {
  phase: Phase;
  orderNumber: string | null;
  onPay: () => void;
};

const renderView = ({ phase, orderNumber, onPay }: ViewProps) => {
  const displayOrderNumber = orderNumber?.toUpperCase() ?? null;
  const currency = phase.kind === "summary" ? (phase.order.currency ?? "AUD") : "AUD";

  return (
    <section className="py-10 sm:py-14">
      <Container className="max-w-2xl">
        <div className="space-y-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-6 shadow-soft">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold text-[color:var(--color-ink)] sm:text-3xl">
              {phase.kind === "paid" ? "Payment received" : "Pay your order by card"}
            </h1>
            {displayOrderNumber ? (
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                Order{" "}
                <span className="font-mono font-semibold text-[color:var(--color-ink)]">
                  {displayOrderNumber}
                </span>
              </p>
            ) : null}
          </div>

          {!orderNumber && phase.kind === "loading" ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              This link looks incomplete. Open it again from the store you ordered from.
            </p>
          ) : null}

          {phase.kind === "loading" ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]" role="status">
              Loading your order…
            </p>
          ) : null}

          {phase.kind === "paying" ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]" role="status">
              Taking you to secure card payment…
            </p>
          ) : null}

          {phase.kind === "error" ? (
            <p className="text-sm text-[color:var(--color-danger)]" role="alert">
              {phase.message}
            </p>
          ) : null}

          {phase.kind === "paid" ? (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                Your payment went through and your order is confirmed. A confirmation
                email is on its way.
              </p>
              {phase.orderStatusUrl ? (
                <Button variant="cta" onClick={() => window.location.assign(phase.orderStatusUrl!)}>
                  View my order
                </Button>
              ) : null}
            </div>
          ) : null}

          {phase.kind === "summary" && phase.order.state === "payable" ? (
            <div className="space-y-4">
              <ul className="divide-y divide-[color:var(--color-border)]">
                {(phase.order.items ?? []).map((item, index) => (
                  <li
                    key={`${item.name}-${item.variant}-${index}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span className="text-[color:var(--color-ink)]">
                      {item.name}
                      {item.variant ? (
                        <span className="text-[color:var(--color-ink-muted)]"> — {item.variant}</span>
                      ) : null}
                      <span className="text-[color:var(--color-ink-muted)]"> ×{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-[color:var(--color-ink)]">
                      {formatAmount(item.lineTotal, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-[color:var(--color-border)] pt-4 text-sm">
                <div className="flex justify-between text-[color:var(--color-ink-muted)]">
                  <span>Subtotal</span>
                  <span>{formatAmount(phase.order.subtotal ?? 0, currency)}</span>
                </div>
                {(phase.order.discountAmount ?? 0) > 0 ? (
                  <div className="flex justify-between text-[color:var(--color-ink-muted)]">
                    <span>
                      Discount
                      {phase.order.discountCode ? (
                        <span className="font-mono"> ({phase.order.discountCode})</span>
                      ) : null}
                    </span>
                    <span className="text-[color:var(--color-success)]">
                      −{formatAmount(phase.order.discountAmount ?? 0, currency)}
                    </span>
                  </div>
                ) : null}
                {(phase.order.voucherTotal ?? 0) > 0 ? (
                  <div className="flex justify-between text-[color:var(--color-ink-muted)]">
                    <span>
                      Store credit
                      {phase.order.voucherCodes?.length ? (
                        <span className="font-mono">
                          {" "}
                          ({phase.order.voucherCodes.map((voucher) => voucher.code).join(", ")})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[color:var(--color-success)]">
                      −{formatAmount(phase.order.voucherTotal ?? 0, currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-[color:var(--color-ink-muted)]">
                  <span>Shipping</span>
                  <span>{formatAmount(phase.order.shippingCost ?? 0, currency)}</span>
                </div>
                {(phase.order.signatureFee ?? 0) > 0 ? (
                  <div className="flex justify-between text-[color:var(--color-ink-muted)]">
                    <span>Signature on delivery</span>
                    <span>{formatAmount(phase.order.signatureFee ?? 0, currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 text-base font-bold text-[color:var(--color-ink)]">
                  <span>Total</span>
                  <span>{formatAmount(phase.order.total ?? 0, currency)}</span>
                </div>
              </div>
              <Button variant="cta" className="w-full" onClick={onPay}>
                Pay by card
              </Button>
              <p className="text-xs text-[color:var(--color-ink-muted)]">
                You&apos;ll be taken to our secure payment provider to enter your card
                details. Your order is confirmed as soon as the payment goes through.
              </p>
            </div>
          ) : null}

          {phase.kind === "summary" && phase.order.state === "already_paid" ? (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                This order is already paid — nothing left to do.
              </p>
              {phase.order.orderStatusUrl ? (
                <Button
                  variant="primary"
                  onClick={() => window.location.assign(phase.order.orderStatusUrl!)}
                >
                  View my order
                </Button>
              ) : null}
            </div>
          ) : null}

          {phase.kind === "summary" && phase.order.state === "cancelled" ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              This order was cancelled. If you believe that&apos;s a mistake, contact the
              store you ordered from.
            </p>
          ) : null}

          {phase.kind === "summary" &&
          (phase.order.state === "not_found" || phase.order.state === "not_card") ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              We couldn&apos;t find a card order with this number. Open your payment link
              again from the store you ordered from.
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
};
