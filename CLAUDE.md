@AGENTS.md

# Peel Supply — CLAUDE.md

Storefront that mirrors the Au Peptide Labs catalogue (timmyvm/preptide). Same
design system and layout as APL, rebuilt as its own app.

## Stack
- Next.js 16 App Router (canary), React 19, TypeScript strict, Tailwind CSS 4
- Supabase: the SAME project as APL. This app's own tables are `sticker_*`
  (supabase/migrations/). It mirrors APL's `variants` (stock and AUD price)
  into `sticker_variants` through `peptide_variant_id`, and its orders
  decrement APL's `variants.stock` directly.
- Resend over fetch for order emails (optional; skipped while unset)
- Vercel (syd1), hourly cron cancels unpaid orders

## Core rules
- Always verify: `npx tsc --noEmit`, `npm run build`, and look at the UI at
  1440px and 390px.
- Tailwind only, no inline `style` props. No `any`.
- Never install a dependency without checking the stack already covers it.
  `.npmrc` carries legacy-peer-deps because the canary Next fails
  @vercel/analytics' peer range.
- Commit with an explicit pathspec, never a bare `git commit` after `git add`.

## Money and stock
- APL's `variants` table is the source of truth for stock and price. A pg_cron
  job copies them into `sticker_variants` (`stock`, `price_aud`) every minute.
  The client never sends a price: `/api/orders` passes variant ids and
  quantities to `place_sticker_order()`, which prices from `sticker_variants`,
  locks the APL variant row, decrements its stock, and inserts the order in one
  transaction.
- Shipping fee and free threshold are `SHIPPING_FACTS` in app/lib/shipping.ts.
  The server passes the same numbers to the RPC, so cart, checkout and the
  stored order agree. Change them there only. Free shipping applies AT the
  threshold (`>=` in getShippingCost and the RPC), so copy says "A$40+" or
  "A$40 or more", never "over A$40".
- Promised windows are constants in app/lib/order-policy.ts
  (`UNPAID_ORDER_HOURS`, `DAMAGE_CLAIM_WINDOW_DAYS`); the FAQ, policies,
  checkout and order page read them. Never type the number into copy.
- Per-line cap is `MAX_QUANTITY_PER_ITEM` (10), enforced in the UI and in SQL.
- Unpaid orders hold stock; `/api/cron/cancel-stale-orders` cancels them after
  `UNPAID_ORDER_HOURS` (app/lib/order-policy.ts) and puts stock back. Copy
  that states the window reads that constant.
- Every new SECURITY DEFINER function ends with `revoke execute ... from
  public, anon, authenticated; grant ... to service_role;`.
- Catalogue tables are publicly readable (RLS: visible products only); orders
  and subscribers are service-role only.

## Copy
- Facts only. No reviews, ratings, order counts, "selling fast" or countdowns
  unless they come from real data. "Limited run of N" reads
  `sticker_products.edition_size`, so it must match what was printed.
- Business identity (legal name, ABN, support email) comes from env through
  app/lib/business-identity.ts. Never type them into a component.
- No street address or phone number anywhere.

## Layout
- Header heights are CSS-only (promo bar h-9, header h-24); never drive a
  layout dimension from matchMedia/useState.
- Shop/Learn dropdowns are CSS-only (`group-hover`), never conditionally
  rendered, so their links stay in the server HTML.
- Body scroll locking goes through app/hooks/useScrollLock.ts.
- Anything that must be seen before payment on checkout is rendered in BOTH
  the desktop summary and the mobile column.
- Sticker images are transparent PNGs: render them `object-contain`.
