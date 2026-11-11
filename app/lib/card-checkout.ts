/**
 * Card-payment handoff for peptide-store orders: the route, the summary the
 * pay page is allowed to see, and money formatting in the order's currency.
 *
 * Client-safe: no server-only imports.
 */

/** Peptide-store card orders are sent here as /A=order?A-123456. */
export const CARD_CHECKOUT_PATH = "/A=order";

export type CardOrderItem = {
  name: string;
  variant: string;
  quantity: number;
  lineTotal: number;
};

export type PayableCardOrder = {
  state: "payable";
  orderNumber: string;
  items: CardOrderItem[];
  subtotal: number;
  discountAmount: number;
  discountCode: string | null;
  voucherCodes: string[];
  voucherTotal: number;
  shippingCost: number;
  signatureFee: number;
  total: number;
  currency: string;
};

export type ClosedCardOrderState =
  | "already_paid"
  | "cancelled"
  | "not_card"
  | "not_found"
  | "invalid_link";

/**
 * What the pay page receives. Deliberately narrow: anyone can type an order
 * number into the URL, so this never carries the buyer's email or the signed
 * order-status link. The status link is only handed out after Stripe confirms
 * a payment for the session.
 */
export type CardOrderSummary =
  | PayableCardOrder
  | { state: ClosedCardOrderState; orderNumber: string };

const CURRENCIES = ["AUD", "USD", "EUR"] as const;

/**
 * The upper-case code when it's a currency the peptide store charges in;
 * null otherwise, so an unexpected code is refused rather than charged as AUD.
 */
export const parseOrderCurrency = (value: unknown): string | null => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (CURRENCIES as readonly string[]).includes(code) ? code : null;
};

/** "$185.95" in the order's own currency; pair it with the code where it matters. */
export const formatOrderAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: parseOrderCurrency(currency) ?? "AUD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/** Only http(s) links are ever navigated to. */
export const toSafeHttpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};
