-- ============================================================
--  Frontle v2 — Fase 3: racha real, congelar y reparar (PLAN-FRONTLE-V2 §5.2)
--
--  Dos cosas en esta migración:
--
--  A) ARREGLO DE SEGURIDAD de la Fase 2. La política de la 0009 dejaba a
--     cualquiera insertar un GASTO con el player_id de otro, y esas
--     direcciones son públicas en `scores` → se podía drenar el saldo ajeno
--     (dinero real). Ahora los gastos solo entran por funciones SECURITY
--     DEFINER que exigen el `secret` del jugador.
--
--     El secret lo genera el cliente y se liga al player_id con
--     first-write-wins. Como MiniPay PROHÍBE personal_sign, no hay firma
--     posible: la vía de recuperación en otro dispositivo es COMPRAR
--     monedas — la tx on-chain prueba control de la wallet, así que
--     `credit-coins` (service role) puede rotar el secret a ese dispositivo.
--
--  B) La racha deja de ser "días jugados" y pasa a ser la racha REAL derivada
--     en el servidor, donde los ESCUDOS (`streak_shields`) cuentan como día
--     cubierto. Un escudo solo nace pagando: se inserta dentro de la misma
--     transacción que el gasto de monedas, así que si el saldo no alcanza,
--     el escudo tampoco existe.
-- ============================================================

-- --- A) Identidad de gasto ---------------------------------------------------
create table if not exists public.player_secrets (
  player_id   text primary key check (player_id <> ''),
  secret_hash text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.player_secrets enable row level security;
-- Sin políticas: nadie lo lee ni lo escribe con la anon key. Solo las
-- funciones SECURITY DEFINER y el service role (que salta RLS).

-- Liga el secret al jugador (first-write-wins) o confirma que coincide.
create or replace function public.claim_player_secret(p_player text, p_secret text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  h text := encode(sha256(p_secret::bytea), 'hex');
  existing text;
begin
  if p_player is null or p_player = '' or length(coalesce(p_secret, '')) < 16 then
    return false;
  end if;
  select secret_hash into existing from public.player_secrets where player_id = p_player;
  if existing is null then
    insert into public.player_secrets (player_id, secret_hash) values (p_player, h)
      on conflict (player_id) do nothing;
    return true;
  end if;
  return existing = h;
end $$;

-- Guard interno: ¿el secret corresponde al jugador?
create or replace function public.check_secret(p_player text, p_secret text)
returns boolean
language sql security definer set search_path = public, pg_temp stable as $$
  select exists (
    select 1 from public.player_secrets
    where player_id = p_player
      and secret_hash = encode(sha256(coalesce(p_secret, '')::bytea), 'hex')
  );
$$;

-- Gasto de monedas autenticado. Reemplaza el insert directo del cliente.
create or replace function public.spend_coins(p_player text, p_secret text, p_kind text, p_ref text default null)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cost int;
begin
  if not public.check_secret(p_player, p_secret) then
    raise exception 'identidad no verificada' using errcode = 'P0002';
  end if;
  cost := case p_kind
    when 'spend_hint' then 3
    when 'spend_hint_strong' then 5
    when 'spend_attempt' then 5
    else null end;
  if cost is null then
    raise exception 'item no comprable aqui' using errcode = 'P0003';
  end if;
  -- El trigger de saldo aborta la transacción si no alcanza.
  insert into public.coin_ledger (player_id, kind, amount, ref)
    values (p_player, p_kind, -cost, p_ref);
  return (select coalesce(sum(amount), 0)::int from public.coin_ledger where player_id = p_player);
end $$;

-- El cliente ya NO inserta gastos directamente.
drop policy if exists "coin_ledger_public_spend" on public.coin_ledger;
revoke insert on public.coin_ledger from anon, authenticated;

-- --- B) Escudos de racha -----------------------------------------------------
create table if not exists public.streak_shields (
  player_id  text not null check (player_id <> ''),
  day        int  not null check (day between 20250101 and 21001231),
  kind       text not null check (kind in ('freeze', 'repair')),
  created_at timestamptz not null default now(),
  primary key (player_id, day)
);

-- Congeladores comprados y aún sin usar (máx 2 en reserva, patrón Duolingo).
create table if not exists public.streak_freezes (
  id           bigint generated always as identity primary key,
  player_id    text not null check (player_id <> ''),
  consumed_day int,
  created_at   timestamptz not null default now()
);
create index if not exists streak_freezes_player_idx on public.streak_freezes (player_id) where consumed_day is null;

alter table public.streak_shields enable row level security;
alter table public.streak_freezes enable row level security;

drop policy if exists "streak_shields_public_read" on public.streak_shields;
create policy "streak_shields_public_read" on public.streak_shields for select using (true);
drop policy if exists "streak_freezes_public_read" on public.streak_freezes;
create policy "streak_freezes_public_read" on public.streak_freezes for select using (true);
-- Sin políticas de insert: solo las funciones de abajo crean escudos.

-- Días que cuentan para la racha: jugados + cubiertos por un escudo.
create or replace function public.streak_days(p_player text)
returns table (d date)
language sql security definer set search_path = public, pg_temp stable as $$
  select distinct to_date(day::text, 'YYYYMMDD') from public.scores where player_id = p_player
  union
  select distinct to_date(day::text, 'YYYYMMDD') from public.streak_shields where player_id = p_player;
$$;

-- Largo del run que TERMINA exactamente en p_end (0 si no hay).
create or replace function public.streak_run_ending(p_player text, p_end date)
returns int
language sql security definer set search_path = public, pg_temp stable as $$
  with runs as (
    select count(*) as len, max(d) as last_d
    from (select d, d - (row_number() over (order by d))::int as grp from public.streak_days(p_player)) g
    group by grp
  )
  select coalesce((select len from runs where last_d = p_end), 0)::int;
$$;

-- Racha vigente: el run que termina hoy o ayer (ayer cuenta — el reto de hoy
-- puede seguir pendiente sin romper la racha en pantalla).
create or replace function public.current_streak(p_player text)
returns int
language sql security definer set search_path = public, pg_temp stable as $$
  select greatest(
    public.streak_run_ending(p_player, (now() at time zone 'utc')::date),
    public.streak_run_ending(p_player, (now() at time zone 'utc')::date - 1)
  );
$$;

-- Compra un congelador para la reserva (15 🪙, máx 2 sin usar).
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
  insert into public.coin_ledger (player_id, kind, amount) values (p_player, 'spend_freeze', -15);
  insert into public.streak_freezes (player_id) values (p_player);
  return have + 1;
end $$;

-- Consume congeladores para tapar los días perdidos desde la última jugada.
-- Solo si ALCANZAN para tapar todo el hueco: si la racha ya está rota sin
-- remedio, no se gastan (más justo que quemarlos en vano).
create or replace function public.sync_streak(p_player text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  last_d date;
  today  date := (now() at time zone 'utc')::date;
  gap    int;
  have   int;
  g      date;
  fid    bigint;
begin
  if p_player is null or p_player = '' then return 0; end if;
  select max(d) into last_d from public.streak_days(p_player);
  if last_d is null then return 0; end if;

  gap := (today - last_d)::int - 1;  -- días enteros perdidos entre medias
  if gap > 0 then
    select count(*) into have from public.streak_freezes where player_id = p_player and consumed_day is null;
    if have >= gap then
      for g in select generate_series(last_d + 1, today - 1, interval '1 day')::date loop
        select id into fid from public.streak_freezes
          where player_id = p_player and consumed_day is null order by id limit 1;
        exit when fid is null;
        update public.streak_freezes set consumed_day = to_char(g, 'YYYYMMDD')::int where id = fid;
        insert into public.streak_shields (player_id, day, kind)
          values (p_player, to_char(g, 'YYYYMMDD')::int, 'freeze')
          on conflict do nothing;
      end loop;
    end if;
  end if;
  return public.current_streak(p_player);
end $$;

-- ¿Hay un día reparable? Devuelve 0 o 1 fila con el día y su precio exacto,
-- para poder enseñarlo en la UI antes de cobrar.
create or replace function public.repair_quote(p_player text)
returns table (day int, cost int, streak_len int)
language sql security definer set search_path = public, pg_temp stable as $$
  with cand as (select (select max(d) from public.streak_days(p_player)) + 1 as c)
  select to_char(c, 'YYYYMMDD')::int,
         case when public.streak_run_ending(p_player, c - 1) > 7 then 50 else 25 end,
         public.streak_run_ending(p_player, c - 1)
  from cand
  where c is not null
    and c >= (now() at time zone 'utc')::date - 2
    and c < (now() at time zone 'utc')::date
    and public.streak_run_ending(p_player, c - 1) > 0;
$$;

-- Repara un día perdido (ventana 48h): 25 🪙 si la racha era ≤ 7, 50 si era mayor.
create or replace function public.repair_streak(p_player text, p_secret text, p_day int)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_day date := to_date(p_day::text, 'YYYYMMDD');
  today date := (now() at time zone 'utc')::date;
  len   int;
begin
  if not public.check_secret(p_player, p_secret) then
    raise exception 'identidad no verificada' using errcode = 'P0002';
  end if;
  if v_day < today - 2 or v_day >= today then
    raise exception 'fuera de la ventana de reparacion' using errcode = 'P0005';
  end if;
  if exists (select 1 from public.streak_days(p_player) sd where sd.d = v_day) then
    raise exception 'ese dia no esta perdido' using errcode = 'P0006';
  end if;
  -- Solo tiene sentido si hay una racha que termina justo antes del hueco.
  len := public.streak_run_ending(p_player, v_day - 1);
  if len = 0 then
    raise exception 'no hay racha que reparar' using errcode = 'P0007';
  end if;
  insert into public.coin_ledger (player_id, kind, amount)
    values (p_player, case when len > 7 then 'spend_repair_long' else 'spend_repair' end,
            case when len > 7 then -50 else -25 end);
  insert into public.streak_shields (player_id, day, kind) values (p_player, p_day, 'repair');
  return public.current_streak(p_player);
end $$;

-- --- Vista de progreso: la racha ahora incluye escudos ------------------------
-- `days_played` y `points` siguen contando SOLO partidas reales (un escudo no
-- es una partida); lo único que cambia es el cálculo de la racha.
drop view if exists public.player_progress;

create view public.player_progress
with (security_invoker = on) as
with days as (
  select distinct player_id, to_date(day::text, 'YYYYMMDD') as d
  from public.scores
  where player_id is not null and player_id <> ''
  union
  select distinct player_id, to_date(day::text, 'YYYYMMDD') as d
  from public.streak_shields
),
runs as (
  select player_id, count(*) as len, max(d) as last_d
  from (
    select player_id, d,
           d - (row_number() over (partition by player_id order by d))::int as grp
    from days
  ) g
  group by player_id, grp
),
plays as (
  select
    player_id,
    count(distinct day)::int          as days_played,
    count(distinct (day, level))::int as solves
  from public.scores
  where player_id is not null and player_id <> ''
  group by player_id
)
select
  p.player_id,
  p.days_played,
  p.solves * 10 as points,
  coalesce((
    select r.len from runs r
    where r.player_id = p.player_id
      and r.last_d >= (now() at time zone 'utc')::date - 1
    order by r.last_d desc
    limit 1
  ), 0)::int as streak
from plays p;

grant select on public.player_progress to anon, authenticated;
grant select on public.streak_shields, public.streak_freezes to anon, authenticated;
grant execute on function public.claim_player_secret(text, text) to anon, authenticated;
grant execute on function public.spend_coins(text, text, text, text) to anon, authenticated;
grant execute on function public.buy_streak_freeze(text, text) to anon, authenticated;
grant execute on function public.sync_streak(text) to anon, authenticated;
grant execute on function public.repair_streak(text, text, int) to anon, authenticated;
grant execute on function public.repair_quote(text) to anon, authenticated;
-- Internas: no se exponen a PostgREST.
revoke execute on function public.check_secret(text, text) from anon, authenticated;
revoke execute on function public.streak_days(text) from anon, authenticated;
revoke execute on function public.streak_run_ending(text, date) from anon, authenticated;
revoke execute on function public.current_streak(text) from anon, authenticated;
