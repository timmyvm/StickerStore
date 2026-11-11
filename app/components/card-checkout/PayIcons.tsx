import type { ReactNode } from "react";

type IconProps = { className?: string };

const Icon = ({ className = "h-5 w-5", children }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ShieldCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const PhoneCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
    <path d="m9.5 10.5 1.8 1.8 3.2-3.3" />
  </Icon>
);

export const MailCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12V6.5A1.5 1.5 0 0 0 19.5 5h-15A1.5 1.5 0 0 0 3 6.5v11A1.5 1.5 0 0 0 4.5 19H13" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
    <path d="m16 18.5 2 2 3.5-3.5" />
  </Icon>
);

export const ReceiptIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
  </Icon>
);

export const CardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19" />
    <path d="M6 15h4" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V13" />
    <path d="M12 16.5h.01" />
  </Icon>
);

export const CircleSlashIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.7 5.7 12.6 12.6" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const SpinnerIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={`motion-safe:animate-spin ${className}`} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const MARK_CLASS = "h-6 w-[38px]";
const MARK_FONT = "Arial, Helvetica, sans-serif";

/**
 * Acceptance marks for the card brands Stripe accepts by default on an
 * Australian account. Drawn inline so the pay page makes no third-party
 * requests.
 */
export const CardBrandMarks = () => (
  <ul className="flex items-center gap-1.5" aria-label="Accepted cards">
    <li>
      <svg viewBox="0 0 38 24" className={MARK_CLASS} role="img" aria-label="Visa">
        <rect x="0.5" y="0.5" width="37" height="23" rx="3.5" fill="#ffffff" stroke="#e2e8f0" />
        <text
          x="19"
          y="16.2"
          textAnchor="middle"
          fontFamily={MARK_FONT}
          fontSize="10.5"
          fontStyle="italic"
          fontWeight="700"
          letterSpacing="0.3"
          fill="#1a1f71"
        >
          VISA
        </text>
      </svg>
    </li>
    <li>
      <svg viewBox="0 0 38 24" className={MARK_CLASS} role="img" aria-label="Mastercard">
        <rect x="0.5" y="0.5" width="37" height="23" rx="3.5" fill="#ffffff" stroke="#e2e8f0" />
        <circle cx="15" cy="12" r="7" fill="#eb001b" />
        <circle cx="23" cy="12" r="7" fill="#f79e1b" />
        <path d="M19 6.255a7 7 0 0 1 0 11.49a7 7 0 0 1 0-11.49z" fill="#ff5f00" />
      </svg>
    </li>
    <li>
      <svg viewBox="0 0 38 24" className={MARK_CLASS} role="img" aria-label="American Express">
        <rect x="0.5" y="0.5" width="37" height="23" rx="3.5" fill="#016fd0" stroke="#016fd0" />
        <text
          x="19"
          y="15.4"
          textAnchor="middle"
          fontFamily={MARK_FONT}
          fontSize="8.5"
          fontWeight="700"
          letterSpacing="0.4"
          fill="#ffffff"
        >
          AMEX
        </text>
      </svg>
    </li>
  </ul>
);
