import { Fragment } from "react";
import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";
import { CheckIcon } from "@/app/components/card-checkout/PayIcons";

/** Page frame for every state of the card pay page, so states swap without a jump. */
export const PayShell = ({ children }: { children: ReactNode }) => (
  <section className="py-8 sm:py-12">
    <Container className="max-w-5xl">{children}</Container>
  </section>
);

export const OrderChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-[color:var(--color-ink)]">
    {children}
  </span>
);

const STEPS = ["Order placed", "Payment", "Confirmed"] as const;

type PayStepsProps = {
  /** How many steps are done: 1 while paying, 3 once confirmed. */
  completed: number;
  className?: string;
};

export const PaySteps = ({ completed, className = "" }: PayStepsProps) => (
  <ol
    aria-label="Payment progress"
    className={`flex w-full max-w-md items-center gap-1.5 text-xs font-semibold sm:gap-2.5 sm:text-sm ${className}`}
  >
    {STEPS.map((label, index) => {
      const isDone = index < completed;
      const isCurrent = index === completed;
      return (
        <Fragment key={label}>
          {index > 0 ? (
            <li
              aria-hidden="true"
              className={`h-px min-w-3 flex-1 ${
                index <= completed
                  ? "bg-[color:var(--color-primary)]"
                  : "bg-[color:var(--color-border-soft)]"
              }`}
            />
          ) : null}
          <li
            className="flex shrink-0 items-center gap-1.5"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] sm:h-6 sm:w-6 sm:text-xs ${
                isDone
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                  : isCurrent
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-primary)] ring-4 ring-[color:var(--color-primary)]/15"
                    : "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-ink-subtle)]"
              }`}
            >
              {isDone ? <CheckIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : index + 1}
            </span>
            <span
              className={
                isDone || isCurrent
                  ? "text-[color:var(--color-ink)]"
                  : "text-[color:var(--color-ink-subtle)]"
              }
            >
              {label}
              {isDone ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        </Fragment>
      );
    })}
  </ol>
);

type PayIntroProps = {
  /** Null while the order number is still unknown (server-rendered fallback). */
  orderNumber: string | null;
};

export const PayIntro = ({ orderNumber }: PayIntroProps) => (
  <div className="space-y-5">
    <PaySteps completed={1} />
    <div>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--color-ink)] sm:text-3xl">
        Complete your payment
      </h1>
      {orderNumber ? (
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          Order <OrderChip>{orderNumber}</OrderChip> is placed and waiting for payment.
        </p>
      ) : (
        <p className="mt-2 h-5 w-64 max-w-full rounded-md bg-[color:var(--color-surface-muted)] motion-safe:animate-pulse" />
      )}
    </div>
  </div>
);

/** Two columns from lg: the order on the left, the payment panel on the right. */
export const PayGrid = ({ children }: { children: ReactNode }) => (
  <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
    {children}
  </div>
);

const SKELETON_BAR = "rounded-md bg-[color:var(--color-surface-muted)] motion-safe:animate-pulse";

/**
 * Loading state, shaped like the loaded page. Also the server-rendered
 * Suspense fallback, so the page never flashes blank.
 */
export const PayLoading = ({ orderNumber = null }: { orderNumber?: string | null }) => (
  <PayShell>
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading your order…
      </p>
      <PayIntro orderNumber={orderNumber} />
      <PayGrid>
        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-5 shadow-soft sm:p-6">
          <div className={`h-5 w-36 ${SKELETON_BAR}`} />
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <div className={`h-9 w-9 shrink-0 ${SKELETON_BAR}`} />
              <div className={`h-4 flex-1 ${SKELETON_BAR}`} />
              <div className={`h-4 w-16 ${SKELETON_BAR}`} />
            </div>
          ))}
          <div className={`h-24 ${SKELETON_BAR}`} />
        </div>
        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-5 shadow-card sm:p-6">
          <div className={`h-5 w-44 ${SKELETON_BAR}`} />
          <div className={`h-10 w-40 ${SKELETON_BAR}`} />
          <div className={`h-12 ${SKELETON_BAR}`} />
          <div className={`h-28 ${SKELETON_BAR}`} />
        </div>
      </PayGrid>
    </div>
  </PayShell>
);

export type PayMessageTone = "success" | "info" | "warning" | "neutral" | "danger";

const TONE_CLASSES: Record<PayMessageTone, string> = {
  success: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
  info: "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]",
  warning: "bg-[color:var(--color-warning)]/12 text-[color:var(--color-warning)]",
  neutral: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)]",
  danger: "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
};

type PayMessageProps = {
  tone: PayMessageTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Shows the progress steps above the message (1 paying, 3 confirmed). */
  steps?: number;
};

/** One-card state: confirming, paid, cancelled, link problems, errors. */
export const PayMessage = ({ tone, icon, title, children, actions, steps }: PayMessageProps) => (
  <PayShell>
    <div className="mx-auto max-w-lg">
      {steps !== undefined ? <PaySteps completed={steps} className="mx-auto mb-6" /> : null}
      <section
        aria-live="polite"
        className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-6 text-center shadow-card sm:p-8"
      >
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${TONE_CLASSES[tone]}`}>
          {icon}
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-[color:var(--color-ink)] sm:text-3xl">
          {title}
        </h1>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
          {children}
        </div>
        {actions ? <div className="mt-6 flex flex-col items-center gap-3">{actions}</div> : null}
      </section>
    </div>
  </PayShell>
);
