import type { ReactNode } from "react";
import { formatOrderAmount, type PayableCardOrder } from "@/app/lib/card-checkout";

const CodeChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-md bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[color:var(--color-ink)]">
    {children}
  </span>
);

type RowProps = {
  label: ReactNode;
  value: string;
  tone?: "default" | "saving";
};

const Row = ({ label, value, tone = "default" }: RowProps) => (
  <div className="flex items-start justify-between gap-4">
    <dt className="flex flex-wrap items-center gap-1.5 text-[color:var(--color-ink-muted)]">{label}</dt>
    <dd
      className={`shrink-0 tabular-nums ${
        tone === "saving"
          ? "font-semibold text-[color:var(--color-success)]"
          : "text-[color:var(--color-ink)]"
      }`}
    >
      {value}
    </dd>
  </div>
);

/**
 * The buyer's order exactly as the store that owns it priced it: items, every
 * saving, shipping, and the total Stripe will charge.
 */
export const PayOrderSummary = ({ order }: { order: PayableCardOrder }) => {
  const money = (amount: number) => formatOrderAmount(amount, order.currency);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section
      aria-labelledby="pay-summary-heading"
      className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pay-summary-heading" className="text-base font-semibold text-[color:var(--color-ink)]">
          Order summary
        </h2>
        <span className="text-xs text-[color:var(--color-ink-muted)]">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <ul className="mt-2 divide-y divide-[color:var(--color-border)]">
        {order.items.map((item, index) => (
          <li key={`${item.name}-${item.variant}-${index}`} className="flex items-start gap-3 py-3 text-sm">
            <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 text-xs font-bold tabular-nums text-[color:var(--color-ink)]">
              {item.quantity}×
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="break-words font-semibold leading-snug text-[color:var(--color-ink)]">{item.name}</p>
              {item.variant ? (
                <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">{item.variant}</p>
              ) : null}
            </div>
            <span className="shrink-0 pt-0.5 font-semibold tabular-nums text-[color:var(--color-ink)]">
              {money(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-[color:var(--color-border)] pt-4 text-sm">
        <Row label="Subtotal" value={money(order.subtotal)} />
        {order.discountAmount > 0 ? (
          <Row
            label={
              <>
                Discount
                {order.discountCode ? <CodeChip>{order.discountCode}</CodeChip> : null}
              </>
            }
            value={`−${money(order.discountAmount)}`}
            tone="saving"
          />
        ) : null}
        {order.voucherTotal > 0 ? (
          <Row
            label={
              <>
                Store credit
                {order.voucherCodes.map((code) => (
                  <CodeChip key={code}>{code}</CodeChip>
                ))}
              </>
            }
            value={`−${money(order.voucherTotal)}`}
            tone="saving"
          />
        ) : null}
        <Row
          label="Shipping"
          value={order.shippingCost > 0 ? money(order.shippingCost) : "Free"}
          tone={order.shippingCost > 0 ? "default" : "saving"}
        />
        {order.signatureFee > 0 ? (
          <Row label="Signature on delivery" value={money(order.signatureFee)} />
        ) : null}
      </dl>

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[color:var(--color-border)] pt-4">
        <span className="text-base font-bold text-[color:var(--color-ink)]">Total</span>
        <span className="text-lg font-bold tabular-nums text-[color:var(--color-ink)]">
          {money(order.total)}{" "}
          <span className="text-xs font-semibold text-[color:var(--color-ink-muted)]">{order.currency}</span>
        </span>
      </div>
    </section>
  );
};
