-- ============================================================
--  Frontle — Devoluciones de monedas
--
--  Nuevo tipo de movimiento `refund`: crédito positivo con `ref` obligatoria
--  (qué gasto se devuelve), una sola vez por ref. Solo lo escribe el service
--  role (el anon no inserta en coin_ledger desde 0010). No cuenta como venta:
--  las estadísticas solo suman `purchase`.
--
--  Primera devolución: los dos "otra partida" de regiones (ids 949 y 954,
--  5-nov-2026 04:48/04:49 UTC) que se cobraron con la app vieja en caché,
--  justo tras publicar las rondas pagadas con XP, y no dieron XP.
-- ============================================================

alter table public.coin_ledger drop constraint if exists coin_shape;
alter table public.coin_ledger add constraint coin_shape check (
  (kind = 'purchase' and amount > 0 and ref is not null)
  or (kind = 'refund' and amount > 0 and ref is not null)
  or (kind = 'welcome' and amount = 10)
  or (kind = 'spend_hint' and amount = -3)
  or (kind = 'spend_hint_strong' and amount = -5)
  or (kind = 'spend_attempt' and amount = -5)
  or (kind = 'spend_freeze' and amount = -5)
  or (kind = 'spend_repair' and amount = -25)
  or (kind = 'spend_repair_long' and amount = -50)
);

-- Cada gasto se devuelve una sola vez.
create unique index if not exists coin_ledger_refund_ref
  on public.coin_ledger (ref) where kind = 'refund';

insert into public.coin_ledger (player_id, kind, amount, ref)
values
  ('0x7c052c10f5ed20cf5d04a6918fccf01841b86f05', 'refund', 5, 'refund:949'),
  ('0x7c052c10f5ed20cf5d04a6918fccf01841b86f05', 'refund', 5, 'refund:954')
on conflict do nothing;
