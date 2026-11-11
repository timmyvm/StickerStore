import type { ReactNode } from "react";
import { BUSINESS } from "@/app/lib/business-identity";
import { formatOrderAmount, type PayableCardOrder } from "@/app/lib/card-checkout";
import { Button } from "@/app/components/ui/Button";
import {
  AlertIcon,
  CardBrandMarks,
  LockIcon,
  MailCheckIcon,
  PhoneCheckIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from "@/app/components/card-checkout/PayIcons";

type FactProps = { icon: ReactNode; title: string; children: ReactNode };

const Fact = ({ icon, title, children }: FactProps) => (
  <li className="flex gap-3">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
      {icon}
    </span>
    <div>
      <p className="text-sm font-semibold text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">{children}</p>
    </div>
  </li>
);

type PayPanelProps = {
  order: PayableCardOrder;
  /** True from the click until the browser leaves for Stripe. */
  redirecting: boolean;
  payError: string | null;
  onPay: () => void;
};

/**
 * Amount due, the one pay button, and plain facts about how the payment is
 * protected. Every line here is true of Stripe-hosted Checkout as this app
 * uses it; nothing is a badge for its own sake.
 */
export const PayPanel = ({ order, redirecting, payError, onPay }: PayPanelProps) => {
  const amount = formatOrderAmount(order.total, order.currency);
  const descriptor = BUSINESS.cardStatementDescriptor;

  return (
    <section
      aria-labelledby="pay-panel-heading"
      className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-5 shadow-card sm:p-6 lg:sticky lg:top-36"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="pay-panel-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-ink)]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]">
            <LockIcon className="h-4 w-4" />
          </span>
          Secure card payment
        </h2>
        <CardBrandMarks />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
          Amount due
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold tabular-nums text-[color:var(--color-ink)]">
            {amount}
          </span>
          <span className="text-sm font-semibold text-[color:var(--color-ink-muted)]">{order.currency}</span>
        </p>
      </div>

      {payError ? (
        <div
          role="alert"
          className="mt-4 flex gap-2 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 p-3 text-sm text-[color:var(--color-danger)]"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{payError}</p>
        </div>
      ) : null}

      {/* Not `disabled` while redirecting: a dimmed button reads as broken
          while Stripe loads. The click handler ignores repeat presses. */}
      <Button
        variant="cta"
        className={`mt-5 w-full py-3.5 text-base ${redirecting ? "cursor-progress" : ""}`}
        onClick={onPay}
        aria-disabled={redirecting}
      >
        {redirecting ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            Opening secure checkout…
          </>
        ) : (
          <>
            <LockIcon className="h-4 w-4" />
            Pay {amount}
          </>
        )}
      </Button>
      <p className="mt-3 text-center text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
        You&apos;ll enter your card on Stripe&apos;s secure page. Check the address bar shows{" "}
        <span className="font-semibold text-[color:var(--color-ink)]">checkout.stripe.com</span>.
      </p>

      <ul className="mt-5 space-y-4 border-t border-[color:var(--color-border)] pt-5">
        <Fact icon={<ShieldCheckIcon className="h-4 w-4" />} title="Card details go straight to Stripe">
          You type them on Stripe&apos;s page, so they never reach our servers.
        </Fact>
        <Fact icon={<PhoneCheckIcon className="h-4 w-4" />} title="Your bank may ask you to approve it">
          Some banks send a code or an app prompt (3-D Secure) to check it&apos;s really you.
        </Fact>
        <Fact icon={<MailCheckIcon className="h-4 w-4" />} title="Confirmed as soon as it's paid">
          Your order is confirmed the moment the payment goes through, and a confirmation email
          follows.
        </Fact>
        {descriptor ? (
          <Fact
            icon={<ReceiptIcon className="h-4 w-4" />}
            title={`Shows on your statement as ${descriptor}`}
          >
            So you&apos;ll recognise the charge when it appears.
          </Fact>
        ) : null}
      </ul>

      <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-[color:var(--color-border)] pt-4 text-[11px] text-[color:var(--color-ink-subtle)]">
        <LockIcon className="h-3.5 w-3.5" />
        Encrypted connection · Payments processed by{" "}
        <span className="font-bold text-[color:var(--color-ink-muted)]">Stripe</span>
      </p>
    </section>
  );
};
