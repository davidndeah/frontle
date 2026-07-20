-- ============================================================
--  Frontle v2 — El congelador de racha baja a 5 monedas (0.05 USDT)
--
--  Antes costaba 15 🪙 (§5.2 original). Decisión de Santiago (2026-07-20):
--  5 🪙. Hay que tocar dos sitios que fijan el precio en el servidor:
--   · el check `coin_shape` de `coin_ledger` (0009): spend_freeze = -15 → -5;
--   · la función `buy_streak_freeze` (0010), que inserta el gasto.
-- ============================================================

alter table public.coin_ledger drop constraint if exists coin_shape;
alter table public.coin_ledger add constraint coin_shape check (
  (kind = 'purchase' and amount > 0 and ref is not null)
  or (kind = 'welcome' and amount = 10)
  or (kind = 'spend_hint' and amount = -3)
  or (kind = 'spend_hint_strong' and amount = -5)
  or (kind = 'spend_attempt' and amount = -5)
  or (kind = 'spend_freeze' and amount = -5)
  or (kind = 'spend_repair' and amount = -25)
  or (kind = 'spend_repair_long' and amount = -50)
);

create or replace function public.buy_streak_freeze(p_player text, p_secret text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  have int;
begin
  if not public.check_secret(p_player, p_secret) then
    raise exception 'identidad no verificada' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('freeze:' || p_player));
  select count(*) into have from public.streak_freezes where player_id = p_player and consumed_day is null;
  if have >= 2 then
    raise exception 'ya tienes 2 congeladores' using errcode = 'P0004';
  end if;
  insert into public.coin_ledger (player_id, kind, amount) values (p_player, 'spend_freeze', -5);
  insert into public.streak_freezes (player_id) values (p_player);
  return have + 1;
end $$;

grant execute on function public.buy_streak_freeze(text, text) to anon, authenticated;
