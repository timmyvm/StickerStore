-- Mirror AuPeptideLabs stock and price into the sticker store.
--
-- APL's `variants` table is the source of truth. Each sticker variant that
-- points at an APL variant (sticker_variants.peptide_variant_id) copies its
-- stock and AUD price every minute, and orders decrement APL's stock directly
-- so the two storefronts can never sell the same unit twice.

-- 1. Copy APL stock and AUD price into sticker_variants.
create or replace function public.sync_sticker_variants_from_apl()
returns integer
language sql
security definer
set search_path = public
as $$
  with changed as (
    update public.sticker_variants s
       set stock = v.stock,
           price_aud = (v.prices ->> 'AUD')::numeric
      from public.variants v
     where v.id = s.peptide_variant_id
       and v.prices ->> 'AUD' is not null
       and (
         s.stock is distinct from v.stock
         or s.price_aud is distinct from (v.prices ->> 'AUD')::numeric
       )
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke execute on function public.sync_sticker_variants_from_apl() from public, anon, authenticated;
grant execute on function public.sync_sticker_variants_from_apl() to service_role;

-- 2. Run it every minute (pg_cron is already installed in this project).
do $$
begin
  perform cron.unschedule('sticker-mirror-apl');
exception when others then
  null;
end $$;

select cron.schedule(
  'sticker-mirror-apl',
  '* * * * *',
  $$select public.sync_sticker_variants_from_apl()$$
);

-- Bring the mirror up to date straight away.
select public.sync_sticker_variants_from_apl();

-- 3. Place orders against APL stock. Prices and stock for mirrored variants
-- come from APL's row, locked for the duration of the transaction.
create or replace function public.place_sticker_order(
  p_email text,
  p_customer_name text,
  p_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_shipping_fee numeric,
  p_free_shipping_threshold numeric,
  p_marketing_opt_in boolean default false,
  p_notes text default null
)
returns table (
  order_id uuid,
  order_number text,
  subtotal numeric,
  shipping numeric,
  total numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_line record;
  v_variant record;
  v_apl_stock integer;
  v_apl_force_out boolean;
  v_apl_price numeric(10, 2);
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2);
  v_number text;
  v_id uuid;
  v_attempt integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'TOO_MANY_LINES';
  end if;

  for v_line in
    select value ->> 'variantId' as variant_id,
           sum((value ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items)
    group by 1
    order by 1
  loop
    if v_line.variant_id is null or v_line.quantity is null
       or v_line.quantity < 1 or v_line.quantity > 10 then
      raise exception 'BAD_QUANTITY:%', coalesce(v_line.variant_id, '?');
    end if;

    select v.id, v.product_id, v.name, v.size_label, v.price_aud, v.stock,
           v.peptide_variant_id,
           p.name as product_name, p.slug as product_slug, p.hidden
      into v_variant
      from public.sticker_variants v
      join public.sticker_products p on p.id = v.product_id
     where v.id = v_line.variant_id
       for update of v;

    if not found or v_variant.hidden then
      raise exception 'UNKNOWN_ITEM:%', v_line.variant_id;
    end if;

    if v_variant.peptide_variant_id is not null then
      select a.stock, a.force_out_of_stock, (a.prices ->> 'AUD')::numeric
        into v_apl_stock, v_apl_force_out, v_apl_price
        from public.variants a
       where a.id = v_variant.peptide_variant_id
         for update;

      if not found or v_apl_price is null then
        raise exception 'UNKNOWN_ITEM:%', v_line.variant_id;
      end if;
      if v_apl_force_out or v_apl_stock < v_line.quantity then
        raise exception 'OUT_OF_STOCK:%', v_line.variant_id;
      end if;

      update public.variants
         set stock = stock - v_line.quantity
       where id = v_variant.peptide_variant_id;

      update public.sticker_variants
         set stock = v_apl_stock - v_line.quantity,
             price_aud = v_apl_price
       where id = v_variant.id;

      v_variant.price_aud := v_apl_price;
    else
      if v_variant.stock < v_line.quantity then
        raise exception 'OUT_OF_STOCK:%', v_line.variant_id;
      end if;

      update public.sticker_variants
         set stock = stock - v_line.quantity
       where id = v_variant.id;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'productId', v_variant.product_id,
      'productSlug', v_variant.product_slug,
      'variantId', v_variant.id,
      'name', v_variant.product_name,
      'size', v_variant.size_label,
      'quantity', v_line.quantity,
      'unitPrice', v_variant.price_aud,
      'lineTotal', v_variant.price_aud * v_line.quantity
    );
    v_subtotal := v_subtotal + v_variant.price_aud * v_line.quantity;
  end loop;

  v_shipping := case
    when v_subtotal >= p_free_shipping_threshold then 0
    else p_shipping_fee
  end;

  loop
    v_attempt := v_attempt + 1;
    v_number := 'S' || lpad(floor(random() * 1000000)::integer::text, 6, '0');
    insert into public.sticker_orders (
      order_number, email, customer_name, phone, shipping_address, items,
      subtotal, shipping, total, marketing_opt_in, notes
    )
    values (
      v_number, lower(trim(p_email)), trim(p_customer_name), nullif(trim(p_phone), ''),
      p_shipping_address, v_lines, v_subtotal, v_shipping, v_subtotal + v_shipping,
      coalesce(p_marketing_opt_in, false), nullif(trim(p_notes), '')
    )
    on conflict on constraint sticker_orders_order_number_key do nothing
    returning id into v_id;
    exit when v_id is not null;
    if v_attempt >= 10 then
      raise exception 'ORDER_NUMBER_EXHAUSTED';
    end if;
  end loop;

  return query select v_id, v_number, v_subtotal, v_shipping, v_subtotal + v_shipping;
end;
$$;

-- 4. Cancelling an unpaid order puts stock back on APL too.
create or replace function public.cancel_stale_sticker_orders(p_hours integer default 48)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_line record;
  v_apl_id text;
  v_count integer := 0;
begin
  for v_order in
    update public.sticker_orders
       set status = 'cancelled', cancelled_at = now()
     where status = 'pending'
       and created_at < now() - make_interval(hours => p_hours)
    returning items
  loop
    for v_line in
      select line ->> 'variantId' as variant_id,
             (line ->> 'quantity')::integer as quantity
        from jsonb_array_elements(v_order.items) as line
    loop
      update public.sticker_variants v
         set stock = v.stock + v_line.quantity
       where v.id = v_line.variant_id
       returning v.peptide_variant_id into v_apl_id;

      if v_apl_id is not null then
        update public.variants
           set stock = stock + v_line.quantity
         where id = v_apl_id;
      end if;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.cancel_stale_sticker_orders(integer) from public, anon, authenticated;
grant execute on function public.cancel_stale_sticker_orders(integer) to service_role;
