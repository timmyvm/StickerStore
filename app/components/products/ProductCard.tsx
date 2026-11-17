"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/app/lib/types";
import { useCart } from "@/app/providers/CartProvider";
import {
  formatMoney,
  getCheapestVariant,
  getDefaultVariant,
  isProductSoldOut,
} from "@/app/lib/currency";
import { productPath } from "@/app/lib/product-slugs";
import { Button } from "@/app/components/ui/Button";
import { LinkButton } from "@/app/components/ui/LinkButton";
import { Modal } from "@/app/components/ui/Modal";
import { getEditionLine, getProductSpecRows } from "@/app/components/products/product-facts";

type ProductCardProps = {
  product: Product;
};

// Narrowest card is ~160px (2-up on a phone, inside the showcase's 250px
// scroll row on the homepage); widest is a quarter of the 72rem container.
const CARD_IMAGE_SIZES = "(min-width: 1280px) 270px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 65vw";

const ProductInfoModal = ({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) => (
  <Modal open={open} title={product.name} onClose={onClose}>
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 rounded-xl bg-[color:var(--color-surface)] px-4 py-3">
        {product.variants.map((variant) => (
          <div key={variant.id} className="flex items-center gap-2 text-sm">
            <span className="text-[color:var(--color-ink-muted)]">{variant.sizeLabel}</span>
            <span className="font-semibold text-[color:var(--color-ink)]">
              {formatMoney(variant.price)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
        {product.shortDescription}
      </p>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink)]">
          Specifications
        </h3>
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <tbody>
              {getProductSpecRows(product).map((row, i) => (
                <tr
                  key={row.label}
                  className={
                    i % 2 === 0
                      ? "bg-[color:var(--color-surface)]"
                      : "bg-[color:var(--color-surface-elevated)]"
                  }
                >
                  <td className="w-2/5 px-3 py-2 font-semibold text-[color:var(--color-ink-muted)]">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-[color:var(--color-ink)]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Link
        href={productPath(product)}
        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--color-primary)] transition hover:text-[color:var(--color-primary-soft)]"
      >
        View {product.name}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  </Modal>
);

/**
 * Sticker card, ported from APL's ProductCard. The only badges on the image
 * are a functional state (SOLD OUT) and the finish. No urgency, ratings or
 * "popular" flags: the edition line is the printed run, nothing more.
 */
export const ProductCard = ({ product }: ProductCardProps) => {
  const { addItem } = useCart();
  const [infoOpen, setInfoOpen] = useState(false);
  const quickAddVariant = getDefaultVariant(product.variants);
  const cheapestVariant = getCheapestVariant(product.variants);
  const hasMultipleVariants = product.variants.length > 1;
  const price = `${hasMultipleVariants ? "From " : ""}${formatMoney(cheapestVariant.price)}`;
  const isSoldOut = isProductSoldOut(product);

  const handleQuickAdd = () => {
    if (isSoldOut) return;
    addItem(product.id, quickAddVariant.id, 1);
  };

  return (
    <>
      <div
        className={[
          "group flex h-full min-w-0 flex-col gap-4 rounded-[4px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-4",
          "transition-all duration-[250ms] ease-in-out",
          isSoldOut ? "hover:opacity-60" : "card-glow-hover hover:scale-[1.01]",
        ].join(" ")}
      >
        <div className="relative">
          <Link
            href={productPath(product)}
            className={[
              "relative block aspect-[4/5] w-full overflow-hidden rounded-[4px] bg-[color:var(--color-surface-muted)]",
              "transition-transform duration-300 ease-in-out",
              isSoldOut
                ? ""
                : "bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] group-hover:-translate-y-[6px]",
            ].join(" ")}
          >
            <Image
              src={product.image.src}
              alt={product.image.alt}
              fill
              sizes={CARD_IMAGE_SIZES}
              className="object-contain p-5 sm:p-6"
            />
            {isSoldOut ? (
              <span className="absolute left-3 top-3 rounded-full bg-[color:var(--color-surface-elevated)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-ink)]">
                SOLD OUT
              </span>
            ) : null}
            {/* On a phone-width card the two pills don't fit side by side, so a
                sold-out card shows only SOLD OUT there. */}
            <span className={`${isSoldOut ? "hidden sm:block" : ""} absolute right-3 top-3 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-muted)] backdrop-blur`}>
              {product.finish}
            </span>
          </Link>
          {/* Quick-add + button — bottom-right of image (the phone's add path;
              the full-width button below is sm+). */}
          {!isSoldOut ? (
            <button
              type="button"
              aria-label={`Add ${product.name} ${quickAddVariant.sizeLabel} to cart`}
              onClick={(event) => {
                event.preventDefault();
                handleQuickAdd();
              }}
              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg transition hover:opacity-90 active:scale-95 sm:h-10 sm:w-10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-1.5">
            <Link href={productPath(product)} className="block min-w-0">
              <h3 className="truncate font-display text-base font-bold tracking-[0.02em] text-[color:var(--color-ink)]">
                {product.name}
              </h3>
            </Link>
            <p className="line-clamp-2 min-h-[2.5em] text-[11.5px] leading-snug text-[color:var(--color-ink-muted)]">
              {product.shortDescription}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 text-sm font-semibold text-[color:var(--color-ink)] sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="shrink-0">{price}</span>
            {/* Multi-size cards show the size count, not the cheapest size, so
                the "Add 7.5 cm" button below names its own size. */}
            <span className="min-w-0 text-[color:var(--color-ink-muted)] sm:break-words sm:text-right">
              {hasMultipleVariants
                ? `${product.variants.length} sizes`
                : cheapestVariant.sizeLabel}
            </span>
          </div>
        </div>
        {isSoldOut ? (
          <LinkButton
            variant="secondary"
            href={productPath(product)}
            className="border-[color:var(--color-primary)] text-[color:var(--color-primary)] transition-colors duration-200 hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white"
          >
            View
          </LinkButton>
        ) : (
          <>
            <Button className="hidden sm:flex" onClick={handleQuickAdd}>
              {hasMultipleVariants
                ? `Add ${quickAddVariant.sizeLabel} · ${formatMoney(quickAddVariant.price)}`
                : "Add to cart"}
            </Button>
            {hasMultipleVariants ? (
              <Link
                href={productPath(product)}
                className="hidden text-center text-xs text-[color:var(--color-ink-muted)] transition hover:text-[color:var(--color-ink)] sm:block"
              >
                View all sizes
              </Link>
            ) : null}
          </>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-[color:var(--color-ink-muted)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h10l4 4v12H5z" />
              <path d="M15 4v4h4" />
            </svg>
            <span className="truncate">{getEditionLine(product)}</span>
          </span>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="shrink-0 text-xs text-[color:var(--color-ink-muted)] transition hover:text-[color:var(--color-ink)]"
          >
            More Info
          </button>
        </div>
      </div>

      <ProductInfoModal product={product} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
};
