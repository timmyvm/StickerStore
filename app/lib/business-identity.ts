/**
 * Business identity — the ONE place the trading name, legal entity, ABN,
 * dispatch location and support email live. Footer, contact page, checkout,
 * policy pages and Organization JSON-LD all read from here.
 *
 * The legal entity, ABN and support inbox come from env so they are typed in
 * once, from the real registration, and never guessed in code. Surfaces that
 * would show them simply leave the line out while they are unset.
 *
 * Client-safe: no server-only imports.
 */
const env = (value: string | undefined) => value?.trim() || null;

export const BUSINESS = {
  tradingName: "Peel Supply",
  /** Registered entity name, e.g. "Example Pty Ltd". */
  legalName: env(process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME),
  abn: env(process.env.NEXT_PUBLIC_BUSINESS_ABN),
  email: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  /**
   * The name card payments show on a bank statement, copied exactly from
   * Stripe (Settings → Public details → Statement descriptor). The card pay
   * page names it so buyers recognise the charge; it's left out while unset.
   */
  cardStatementDescriptor: env(process.env.NEXT_PUBLIC_CARD_STATEMENT_DESCRIPTOR),
  // No street address on any surface: only the dispatch city is published.
  dispatchFrom: {
    city: "Melbourne",
    state: "VIC",
    country: "Australia",
    countryCode: "AU",
  },
} as const;

/** "Example Pty Ltd trading as Peel Supply", or just the trading name. */
export const BUSINESS_ENTITY_LINE = BUSINESS.legalName
  ? `${BUSINESS.legalName} trading as ${BUSINESS.tradingName}`
  : BUSINESS.tradingName;

/** Entity line plus " · ABN …" when an ABN is configured. */
export const BUSINESS_ENTITY_WITH_ABN = BUSINESS.abn
  ? `${BUSINESS_ENTITY_LINE} · ABN ${BUSINESS.abn}`
  : BUSINESS_ENTITY_LINE;

/** "Melbourne, VIC" */
export const BUSINESS_DISPATCH_LOCATION = `${BUSINESS.dispatchFrom.city}, ${BUSINESS.dispatchFrom.state}`;
