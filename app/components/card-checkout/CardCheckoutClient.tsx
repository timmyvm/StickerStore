"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BUSINESS } from "@/app/lib/business-identity";
import {
  CARD_CHECKOUT_PATH,
  toSafeHttpUrl,
  type ClosedCardOrderState,
  type PayableCardOrder,
} from "@/app/lib/card-checkout";
import { Button, getButtonClasses } from "@/app/components/ui/Button";
import {
  AlertIcon,
  ArrowRightIcon,
  CardIcon,
  CheckIcon,
  CircleSlashIcon,
  SpinnerIcon,
} from "@/app/components/card-checkout/PayIcons";
import {
  OrderChip,
  PayGrid,
  PayIntro,
  PayLoading,
  PayMessage,
  PayShell,
} from "@/app/components/card-checkout/PayParts";
import { PayOrderSummary } from "@/app/components/card-checkout/PayOrderSummary";
import { PayPanel } from "@/app/components/card-checkout/PayPanel";

type Phase =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "load-error"; message: string }
  | { kind: "payable"; order: PayableCardOrder; redirecting: boolean; payError: string | null }
  | { kind: "closed"; state: ClosedCardOrderState }
  /** Back from Stripe with a session id: asking Stripe whether it paid. */
  | { kind: "verifying" }
  /** Stripe says the session didn't complete a payment. */
  | { kind: "unpaid" }
  | { kind: "verify-error" }
  | { kind: "paid"; orderNumber: string | null; orderStatusUrl: string | null };

const NETWORK_ERROR = "We couldn't reach the payment service. Check your connection and try again.";
const LOAD_ERROR = "We couldn't load this order. Please try again.";
const PAY_ERROR = "We couldn't open the secure payment page. Please try again.";

const CLOSED_STATES: readonly string[] = [
  "already_paid",
  "cancelled",
  "not_card",
  "not_found",
  "invalid_link",
];
const isClosedState = (value: unknown): value is ClosedCardOrderState =>
  typeof value === "string" && CLOSED_STATES.includes(value);

/**
 * The peptide store links here as /A=order?A-123456 (a bare query key), and
 * Stripe returns to ?order=A-123456. Both are accepted.
 */
const readOrderNumber = (params: URLSearchParams): string | null => {
  const explicit = params.get("order") ?? params.get("A") ?? null;
  if (explicit) return explicit.trim().toUpperCase();
  for (const key of params.keys()) {
    if (/^A-?\d{6}$/i.test(key)) return key.toUpperCase();
  }
  return null;
};

const initialPhase = (sessionId: string | null, orderNumber: string | null): Phase =>
  sessionId ? { kind: "verifying" } : orderNumber ? { kind: "loading" } : { kind: "missing" };

export const CardCheckoutClient = () => {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderNumber = readOrderNumber(searchParams);
  // Signed link factor from the peptide store (order numbers alone are
  // guessable). Forwarded to the summary/pay APIs, never verified here.
  const linkToken = searchParams.get("t");
  const [phase, setPhase] = useState<Phase>(() => initialPhase(sessionId, orderNumber));
  const [attempt, setAttempt] = useState(0);
  const pendingRef = useRef(false);

  /** Back from Stripe: ask the server, which asks Stripe (never the browser). */
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
        };
        if (!isActive) return;
        if (response.ok && payload.state === "paid") {
          setPhase({
            kind: "paid",
            orderNumber: payload.orderNumber ?? orderNumber,
            orderStatusUrl: toSafeHttpUrl(payload.orderStatusUrl),
          });
          return;
        }
        setPhase(response.ok && payload.state === "unpaid" ? { kind: "unpaid" } : { kind: "verify-error" });
      } catch {
        if (isActive) setPhase({ kind: "verify-error" });
      }
    })();
    return () => {
      isActive = false;
    };
  }, [sessionId, orderNumber, attempt]);

  /** The order summary (no side effects, no Stripe call). */
  useEffect(() => {
    if (sessionId || !orderNumber) return;
    let isActive = true;
    (async () => {
      try {
        const query = new URLSearchParams({ order: orderNumber });
        if (linkToken) query.set("t", linkToken);
        const response = await fetch(`/api/card-checkout/session?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          state?: string;
          error?: string;
        };
        if (!isActive) return;
        if (response.ok && payload.state === "payable") {
          setPhase({
            kind: "payable",
            order: payload as PayableCardOrder,
            redirecting: false,
            payError: null,
          });
          return;
        }
        if (response.ok && isClosedState(payload.state)) {
          setPhase({ kind: "closed", state: payload.state });
          return;
        }
        // 400: the number in the link isn't an order number at all.
        setPhase(
          response.status === 400
            ? { kind: "closed", state: "not_found" }
            : { kind: "load-error", message: payload.error ?? LOAD_ERROR }
        );
      } catch {
        if (isActive) setPhase({ kind: "load-error", message: NETWORK_ERROR });
      }
    })();
    return () => {
      isActive = false;
    };
  }, [orderNumber, sessionId, attempt, linkToken]);

  /**
   * Browser Back from Stripe can restore this page from the back-forward
   * cache, frozen mid-redirect. Unlock the button when that happens.
   */
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      pendingRef.current = false;
      setPhase((current) =>
        current.kind === "payable" ? { ...current, redirecting: false } : current
      );
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const retry = useCallback(() => {
    setPhase(initialPhase(sessionId, orderNumber));
    setAttempt((count) => count + 1);
  }, [sessionId, orderNumber]);

  const handlePay = useCallback(async () => {
    if (pendingRef.current || !orderNumber) return;
    pendingRef.current = true;
    setPhase((current) =>
      current.kind === "payable" ? { ...current, redirecting: true, payError: null } : current
    );
    const fail = (message: string) => {
      pendingRef.current = false;
      setPhase((current) =>
        current.kind === "payable" ? { ...current, redirecting: false, payError: message } : current
      );
    };
    try {
      const response = await fetch("/api/card-checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, t: linkToken }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        state?: string;
        checkoutUrl?: string;
        error?: string;
      };
      const checkoutUrl = toSafeHttpUrl(payload.checkoutUrl);
      if (response.ok && payload.state === "payable" && checkoutUrl) {
        window.location.assign(checkoutUrl);
        return; // Stay locked while Stripe loads.
      }
      if (response.ok && isClosedState(payload.state)) {
        pendingRef.current = false;
        setPhase({ kind: "closed", state: payload.state });
        return;
      }
      fail(payload.error ?? PAY_ERROR);
    } catch {
      fail(NETWORK_ERROR);
    }
  }, [orderNumber, linkToken]);

  const descriptor = BUSINESS.cardStatementDescriptor;
  const freshLinkHint = "Open your order page and choose Pay by card to get a fresh payment link.";

  switch (phase.kind) {
    case "loading":
      return <PayLoading orderNumber={orderNumber} />;

    case "payable":
      return (
        <PayShell>
          <PayIntro orderNumber={phase.order.orderNumber} />
          <PayGrid>
            <PayOrderSummary order={phase.order} />
            <PayPanel
              order={phase.order}
              redirecting={phase.redirecting}
              payError={phase.payError}
              onPay={handlePay}
            />
          </PayGrid>
        </PayShell>
      );

    case "verifying":
      return (
        <PayMessage
          steps={1}
          tone="info"
          icon={<SpinnerIcon className="h-7 w-7" />}
          title="Confirming your payment"
        >
          <p role="status">
            We&apos;re checking with Stripe that your payment went through. This only takes a
            moment.
          </p>
        </PayMessage>
      );

    case "paid":
      return (
        <PayMessage
          steps={3}
          tone="success"
          icon={<CheckIcon className="h-7 w-7" />}
          title="Payment received"
          actions={
            <>
              {phase.orderStatusUrl ? (
                <a href={phase.orderStatusUrl} className={getButtonClasses("primary", "w-full sm:w-auto")}>
                  View my order
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              ) : null}
              <p className="text-xs text-[color:var(--color-ink-subtle)]">You can close this page.</p>
            </>
          }
        >
          <p>
            {phase.orderNumber ? (
              <>
                Order <OrderChip>{phase.orderNumber}</OrderChip> is confirmed.
              </>
            ) : (
              "Your order is confirmed."
            )}{" "}
            A confirmation email is on its way.
          </p>
          {descriptor ? (
            <p>
              The charge shows on your card statement as{" "}
              <span className="font-semibold text-[color:var(--color-ink)]">{descriptor}</span>.
            </p>
          ) : null}
        </PayMessage>
      );

    case "unpaid":
      return (
        <PayMessage
          steps={1}
          tone="warning"
          icon={<CardIcon className="h-7 w-7" />}
          title="Payment not completed"
          actions={
            orderNumber ? (
              <a
                href={`${CARD_CHECKOUT_PATH}?order=${encodeURIComponent(orderNumber)}`}
                className={getButtonClasses("cta", "w-full sm:w-auto")}
              >
                Return to payment
              </a>
            ) : null
          }
        >
          <p>No payment was taken and your order is still waiting. You can try again whenever you&apos;re ready.</p>
        </PayMessage>
      );

    case "verify-error":
      return (
        <PayMessage
          tone="warning"
          icon={<AlertIcon className="h-7 w-7" />}
          title="Still confirming your payment"
          actions={
            <Button variant="primary" onClick={retry}>
              Check again
            </Button>
          }
        >
          <p>We couldn&apos;t confirm your payment just now.</p>
          <p>
            If it went through, it&apos;s safe: your order is confirmed automatically and a
            confirmation email follows, even if this page can&apos;t show it yet.
          </p>
        </PayMessage>
      );

    case "load-error":
      return (
        <PayMessage
          tone="danger"
          icon={<AlertIcon className="h-7 w-7" />}
          title="We couldn't load your order"
          actions={
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
          }
        >
          <p>{phase.message}</p>
          <p>Nothing has been charged.</p>
        </PayMessage>
      );

    case "closed":
      if (phase.state === "already_paid") {
        return (
          <PayMessage
            steps={3}
            tone="success"
            icon={<CheckIcon className="h-7 w-7" />}
            title="This order is already paid"
          >
            <p>Nothing more to do here. Your order confirmation email has the details.</p>
          </PayMessage>
        );
      }
      if (phase.state === "cancelled") {
        return (
          <PayMessage
            tone="neutral"
            icon={<CircleSlashIcon className="h-7 w-7" />}
            title="This order was cancelled"
          >
            <p>It can&apos;t be paid any more. If you still want these items, please place a new order.</p>
          </PayMessage>
        );
      }
      if (phase.state === "invalid_link") {
        return (
          <PayMessage
            tone="neutral"
            icon={<AlertIcon className="h-7 w-7" />}
            title="This payment link isn&apos;t valid"
          >
            <p>{freshLinkHint}</p>
          </PayMessage>
        );
      }
      return (
        <PayMessage
          tone="neutral"
          icon={<AlertIcon className="h-7 w-7" />}
          title="We couldn't find this payment"
        >
          <p>{freshLinkHint}</p>
        </PayMessage>
      );

    case "missing":
      return (
        <PayMessage
          tone="neutral"
          icon={<AlertIcon className="h-7 w-7" />}
          title="This payment link is incomplete"
        >
          <p>{freshLinkHint}</p>
        </PayMessage>
      );
  }
};
