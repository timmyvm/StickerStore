import "server-only";

import { parseOrderCurrency, type CardOrderSummary } from "@/app/lib/card-checkout";

/**
 * Client for the peptide store's card-checkout handoff API
 * (/api/orders/card-checkout on the preptide app). Card orders placed on the
 * peptide store are paid HERE, so this app asks that app for the order
 * summary and reports successful payments back. The sticker store never reads
 * or writes the peptide store's Supabase tables directly.
 *
 * Auth: Bearer CARD_CHECKOUT_API_SECRET — the same value set in the peptide
 * store's env.
 */

export type PeptideCardOrder = {
  ok: true;
  state: "payable" | "already_paid" | "cancelled" | "not_card" | "not_found";
  orderNumber: string;
  orderStatusUrl?: string;
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
  customerEmail?: string | null;
};

export type PeptideConfirmResult = {
  ok: boolean;
  orderNumber?: string;
  alreadyConfirmed?: boolean;
  orderStatusUrl?: string;
};

const getBaseUrl = () => {
  const base = process.env.PEPTIDE_STORE_API_URL?.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Peptide store API is not configured: set PEPTIDE_STORE_API_URL.");
  }
  return base;
};

const getSharedSecret = () => {
  const secret = process.env.CARD_CHECKOUT_API_SECRET?.trim();
  if (!secret) {
    throw new Error("Card checkout is not configured: set CARD_CHECKOUT_API_SECRET.");
  }
  return secret;
};

const peptideRequest = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSharedSecret()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : `Peptide store API error (${response.status}).`
    );
  }
  return payload;
};

/** "a123456"/"A 123456"/"A-123456" → "A-123456"; null when it isn't one. */
export const normalizePeptideOrderNumber = (value: string): string | null => {
  const compact = value.replace(/[\s#-]/g, "").toUpperCase();
  return /^A\d{6}$/.test(compact) ? `A-${compact.slice(1)}` : null;
};

/** Order summary for the pay page. Never throws on missing orders — states travel in-band. */
export const fetchPeptideCardOrder = async (
  orderNumber: string
): Promise<PeptideCardOrder> => {
  const payload = await peptideRequest(
    `/api/orders/card-checkout?order=${encodeURIComponent(orderNumber)}`
  );
  return payload as unknown as PeptideCardOrder;
};

const toAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

/**
 * Narrows the peptide store's response to what the public pay page may show.
 * The buyer's email and the signed order-status link stay on the server:
 * order numbers are guessable, so the summary must not unlock anything.
 * Returns null for a payable order without a usable total or currency.
 */
export const toCardOrderSummary = (order: PeptideCardOrder): CardOrderSummary | null => {
  if (order.state !== "payable") {
    return { state: order.state, orderNumber: order.orderNumber };
  }
  const total = toAmount(order.total);
  const currency = parseOrderCurrency(order.currency);
  if (total <= 0 || !currency) return null;
  return {
    state: "payable",
    orderNumber: order.orderNumber,
    items: (order.items ?? []).map((item) => ({
      name: String(item.name ?? ""),
      variant: String(item.variant ?? ""),
      quantity: toAmount(item.quantity),
      lineTotal: toAmount(item.lineTotal),
    })),
    subtotal: toAmount(order.subtotal),
    discountAmount: toAmount(order.discountAmount),
    discountCode: order.discountCode ?? null,
    voucherCodes: (order.voucherCodes ?? []).map((voucher) => voucher.code),
    voucherTotal: toAmount(order.voucherTotal),
    shippingCost: toAmount(order.shippingCost),
    signatureFee: toAmount(order.signatureFee),
    total,
    currency,
  };
};

/** Reports a successful card payment. Idempotent on the peptide store's side. */
export const confirmPeptideCardOrderPaid = async (
  orderNumber: string,
  paymentRef: string
): Promise<PeptideConfirmResult> => {
  const payload = await peptideRequest("/api/orders/card-checkout", {
    method: "POST",
    body: JSON.stringify({ orderNumber, paymentRef }),
  });
  return payload as unknown as PeptideConfirmResult;
};
