-- ============================================================
--  Frontle v2 — Fase 5: divisiones de la liga + wallet obligatoria
--
--  A) WALLET OBLIGATORIA. Igual que el ranking diario, la liga semanal exige
--     wallet: el XP y las monedas solo existen para una dirección. Se impone
--     con checks, no solo en el cliente. (Las tablas estaban vacías: no hay
--     datos que migrar.) Esto además elimina el caso raro de "ganó el podio
--     pero no se le puede pagar on-chain".
--
--  B) DIVISIONES (patrón Duolingo). Cada jugador compite en un tier; al cerrar
--     la semana los mejores suben y los últimos bajan. Solo la división MÁS
--     ALTA con participantes se lleva el pot (PLAN §3.4: "los premios altos van
--     a la división superior"); las demás compiten por ascender.
--
--     Tabla mínima a propósito: solo se guarda la fila cuando el tier CAMBIA.
--     `tier_of` mira la última fila con week_start <= la semana consultada, así
--     que un jugador que no se mueve no genera filas.
-- ============================================================

-- --- A) Wallet obligatoria ---------------------------------------------------
alter table public.xp_events   drop constraint if exists xp_wallet_only;
alter table public.xp_events   add  constraint xp_wallet_only   check (player_id ~ '^0x[0-9a-f]{40}$');
alter table public.coin_ledger drop constraint if exists coin_wallet_only;
alter table public.coin_ledger add  constraint coin_wallet_only check (player_id ~ '^0x[0-9a-f]{40}$');

-- --- B) Divisiones -----------------------------------------------------------
-- 1 = Bronce · 2 = Plata · 3 = Oro · 4 = Diamante
create table if not exists public.league_divisions (
  player_id  text not null check (player_id ~ '^0x[0-9a-f]{40}$'),
  week_start date not null,
  tier       int  not null check (tier between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (player_id, week_start)
);

alter table public.league_divisions enable row level security;

drop policy if exists "league_divisions_public_read" on public.league_divisions;
create policy "league_divisions_public_read"
  on public.league_divisions for select using (true);
-- Sin insert público: los ascensos los escribe `close_week_divisions`.

/// Tier con el que un jugador compite en la semana `p_week` (arrastra el
/// último cambio; sin historial, empieza en Bronce).
create or replace function public.tier_of(p_player text, p_week date)
returns int
language sql security definer set search_path = public, pg_temp stable as $$
  select coalesce((
    select tier from public.league_divisions
    where player_id = p_player and week_start <= p_week
    order by week_start desc limit 1
  ), 1);
$$;

-- Tabla de la semana con el tier de cada jugador (lo que pinta la UI).
drop view if exists public.weekly_board;

create view public.weekly_board
with (security_invoker = on) as
select
  x.player_id,
  x.week,
  x.xp,
  x.last_event,
  public.tier_of(x.player_id, x.week) as tier
from public.weekly_xp x;

/// Podio que SE LLEVA EL POT: top 3 de la división más alta con participantes.
/// Desempate por quien llegó antes (mismo criterio del plan §3.2).
create or replace function public.weekly_podium(p_week date)
returns table (player_id text, xp int, tier int)
language sql security definer set search_path = public, pg_temp stable as $$
  with board as (
    select b.player_id, b.xp, b.last_event, b.tier
    from public.weekly_board b
    where b.week = p_week
  )
  select b.player_id, b.xp, b.tier
  from board b
  where b.tier = (select max(t.tier) from board t)
  order by b.xp desc, b.last_event asc
  limit 3;
$$;

/// Cierra las divisiones de la semana `p_week`: dentro de cada tier, los 3
/// primeros suben y los 3 últimos bajan, y el cambio se escribe para la semana
/// siguiente. Solo se mueve un tier con al menos MIN_COHORT jugadores, para no
/// zarandear cohortes diminutas. Idempotente: re-ejecutarlo no duplica (la PK
/// es (player, week) y se hace upsert).
create or replace function public.close_week_divisions(p_week date)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  min_cohort constant int := 5;
  moved int := 0;
begin
  with board as (
    select b.player_id, b.xp, b.last_event, b.tier,
           count(*) over (partition by b.tier) as cohort,
           row_number() over (partition by b.tier order by b.xp desc, b.last_event asc) as rank_asc,
           row_number() over (partition by b.tier order by b.xp asc, b.last_event desc) as rank_desc
    from public.weekly_board b
    where b.week = p_week
  ),
  moves as (
    select player_id,
           case
             when cohort >= min_cohort and rank_asc  <= 3 and tier < 4 then tier + 1
             when cohort >= min_cohort and rank_desc <= 3 and tier > 1 then tier - 1
           end as new_tier
    from board
  )
  insert into public.league_divisions (player_id, week_start, tier)
  select player_id, p_week + 7, new_tier from moves where new_tier is not null
  on conflict (player_id, week_start) do update set tier = excluded.tier;

  get diagnostics moved = row_count;
  return moved;
end $$;

grant select on public.league_divisions, public.weekly_board to anon, authenticated;
grant execute on function public.weekly_podium(date) to anon, authenticated;
-- `weekly_board` corre con security_invoker: quien la consulta necesita poder
-- ejecutar `tier_of` (solo lee, no muta nada).
grant execute on function public.tier_of(text, date) to anon, authenticated;
-- Los ascensos los ejecuta únicamente `close-week` (service role).
revoke execute on function public.close_week_divisions(date) from anon, authenticated;
grant execute on function public.close_week_divisions(date) to service_role;
