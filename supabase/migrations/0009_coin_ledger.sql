-- ============================================================
--  Frontle v2 — Fase 2: ledger de monedas 🪙 (PLAN-FRONTLE-V2 §5)
--
--  Append-only: compras (+), gastos (−). El saldo es la suma — sin estados
--  que corromper. El modelo de confianza es MÁS estricto que el de xp_events:
--
--  · CRÉDITOS (purchase/welcome): SOLO service role (el edge function
--    `credit-coins` verifica la tx on-chain antes de acreditar). La política
--    de insert de anon exige amount < 0 — un cliente no puede acreditarse.
--  · GASTOS (spend_*): el cliente los inserta con la anon key. Solo puede
--    perjudicarse a sí mismo; el trigger `coin_balance_guard` impide gastar
--    más del saldo (con advisory lock por jugador contra dobles gastos
--    concurrentes).
--  · Un hash de compra solo se acredita UNA vez (índice único parcial).
-- ============================================================

create table if not exists public.coin_ledger (
  id         bigint generated always as identity primary key,
  player_id  text not null check (player_id <> ''),
  kind       text not null,
  amount     int  not null,
  -- tx hash en compras; detalle libre en gastos (ej. 'region:CO').
  ref        text,
  created_at timestamptz not null default now(),
  -- Precios del plan §5.2 — el importe de cada ítem lo fija el servidor.
  constraint coin_shape check (
    (kind = 'purchase' and amount > 0 and ref is not null)
    or (kind = 'welcome' and amount = 10)
    or (kind = 'spend_hint' and amount = -3)
    or (kind = 'spend_hint_strong' and amount = -5)
    or (kind = 'spend_attempt' and amount = -5)
    or (kind = 'spend_freeze' and amount = -15)
    or (kind = 'spend_repair' and amount = -25)
    or (kind = 'spend_repair_long' and amount = -50)
  )
);

create index if not exists coin_ledger_player_idx on public.coin_ledger (player_id);
-- Cada tx de compra se acredita una sola vez.
create unique index if not exists coin_ledger_purchase_ref
  on public.coin_ledger (ref) where kind = 'purchase';

-- Saldo nunca negativo. El advisory lock serializa los gastos del mismo
-- jugador dentro de la transacción — dos gastos simultáneos no pueden
-- pasar ambos con el saldo de antes.
create or replace function public.coin_balance_guard() returns trigger
language plpgsql as $$
begin
  if new.amount < 0 then
    perform pg_advisory_xact_lock(hashtext('coins:' || new.player_id));
    if (select coalesce(sum(amount), 0) from public.coin_ledger where player_id = new.player_id) + new.amount < 0 then
      raise exception 'saldo insuficiente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists coin_balance_check on public.coin_ledger;
create trigger coin_balance_check
  before insert on public.coin_ledger
  for each row execute function public.coin_balance_guard();

alter table public.coin_ledger enable row level security;

-- Lectura pública (para el saldo en la UI, mismo criterio que scores).
drop policy if exists "coin_ledger_public_read" on public.coin_ledger;
create policy "coin_ledger_public_read"
  on public.coin_ledger for select
  using (true);

-- Anon SOLO puede gastar (amount < 0). Los créditos entran por service role,
-- que salta RLS — nunca por esta política.
drop policy if exists "coin_ledger_public_spend" on public.coin_ledger;
create policy "coin_ledger_public_spend"
  on public.coin_ledger for insert
  with check (amount < 0 and kind like 'spend_%' and player_id is not null and player_id <> '');

-- --- Saldo -------------------------------------------------------------------
drop view if exists public.coin_balance;

create view public.coin_balance
with (security_invoker = on) as
select player_id, sum(amount)::int as coins
from public.coin_ledger
group by player_id;

grant select on public.coin_balance to anon, authenticated;
grant select, insert on public.coin_ledger to anon, authenticated;
