-- ============================================================
--  Frontle — Vistas públicas de /stats
--  Alimentan la página de estadísticas, que es requisito de listado en
--  MiniPay (DAU, MAU, retención D1/D7/D30, top de países).
--
--  Tres garantías, iguales en las tres vistas:
--   · Solo lectura y solo agregados: nunca exponen `player_id`.
--   · `security_invoker = on` → respetan las políticas RLS de quien consulta,
--     así que `anon` ve exactamente lo que ya podía ver en `scores`. Sin esto
--     una vista pertenece a su dueño y saltaría la RLS.
--   · No tocan `welcome_bonus`, que guarda correos.
--
--  Aplicadas en prod el 2026-07-09.
-- ============================================================

-- --- Agregados generales -------------------------------------------------
-- Se hace DROP y no CREATE OR REPLACE: Postgres no permite reordenar ni
-- renombrar columnas de una vista existente.
drop view if exists public.public_stats;

create view public.public_stats
with (security_invoker = on) as
select
  count(*)::int                                  as plays,
  count(distinct player_id)::int                 as players,
  count(distinct day)::int                       as days_played,
  count(distinct nullif(country_code, ''))::int  as countries_reached,
  count(*) filter (
    where day = to_char(now() at time zone 'utc', 'YYYYMMDD')::int
  )::int                                         as plays_today,
  -- DAU: jugadores distintos hoy (UTC). Ojo: `scores.day` es YYYYMMDD, no el
  -- índice de día del contrato (que cuenta días desde el epoch).
  count(distinct player_id) filter (
    where day = to_char(now() at time zone 'utc', 'YYYYMMDD')::int
  )::int                                         as players_today,
  -- MAU: jugadores distintos en los últimos 30 días
  count(distinct player_id) filter (
    where created_at >= now() - interval '30 days'
  )::int                                         as players_30d,
  min(created_at)::date                          as first_play
from public.scores;

-- --- Top de países (últimos 30 días) -------------------------------------
-- Agrega por el código ISO derivado de la IP. La IP en sí nunca se guarda.
create or replace view public.top_countries_30d
with (security_invoker = on) as
select
  country_code,
  count(*)::int                   as plays,
  count(distinct player_id)::int  as players
from public.scores
where created_at >= now() - interval '30 days'
  and country_code is not null
  and country_code <> ''
group by country_code
order by plays desc, country_code asc;

-- --- Retención por cohorte (D1 / D7 / D30) -------------------------------
-- Para cada jugador se toma su primer día y se mira si volvió dentro de la
-- ventana N.
--
-- Dos sutilezas que hacen honestos los números:
--
--  1. Se usa el MENOR salto positivo, no el mayor. La condición real es
--     "¿existe alguna vuelta dentro de la ventana?". Con max(gap), alguien que
--     vuelve el día +3 y otra vez el +10 daba 10 y contaba como NO retenido a
--     7 días, pese a haber vuelto. Ese error hundía D1 a 3.7% y D7 a 0%.
--     El filtro `>= 1` descarta las partidas del propio día de registro, que
--     no son retención.
--
--  2. El denominador solo incluye cohortes que YA tuvieron N días para
--     volver. Si no, quien se registró ayer contaría como "no retenido a 30
--     días". Cuando `cohort = 0` la ventana aún no es medible y el front
--     muestra un guion, no un 0%.
create or replace view public.retention_cohorts
with (security_invoker = on) as
with firsts as (
  select player_id, min(created_at)::date as first_day
  from public.scores
  where player_id is not null and player_id <> ''
  group by player_id
),
gaps as (
  select
    f.player_id,
    f.first_day,
    min(s.created_at::date - f.first_day) filter (
      where s.created_at::date - f.first_day >= 1
    ) as first_return_gap
  from firsts f
  join public.scores s on s.player_id = f.player_id
  group by f.player_id, f.first_day
),
windows as (
  select 1 as n union all select 7 union all select 30
)
select
  w.n as window_days,
  count(*) filter (
    where g.first_day <= (now() at time zone 'utc')::date - w.n
  )::int as cohort,
  count(*) filter (
    where g.first_day <= (now() at time zone 'utc')::date - w.n
      and g.first_return_gap is not null
      and g.first_return_gap <= w.n
  )::int as retained
from windows w
cross join gaps g
group by w.n
order by w.n;

-- --- Permisos ------------------------------------------------------------
grant select on public.public_stats       to anon, authenticated;
grant select on public.top_countries_30d  to anon, authenticated;
grant select on public.retention_cohorts  to anon, authenticated;
