-- ============================================================
--  Frontle — Desempate de la liga semanal por la marca del reto diario
--
--  Hasta ahora, a igual XP ganaba quien tuviera el último evento más
--  temprano (`last_event`). Con los topes diarios de XP los empates son lo
--  normal, y así el podio lo decidía la hora a la que juega cada uno (lo que
--  favorece a unos husos horarios) y castigaba jugar hasta el final.
--
--  Nuevo orden (desde la semana del 2-nov-2026):
--    1. XP de la semana                       (mayor primero)
--    2. Niveles del reto diario resueltos      (más primero)
--    3. Países de más sobre la ruta óptima     (menos primero)
--    4. Tiempo total en esos niveles           (menos primero)
--    5. Último evento de XP                    (antes primero, como antes)
--
--  Por cada (día, nivel) cuenta la MEJOR marca del jugador. La ruta óptima
--  sale de `daily_challenges` (retos del servidor, desde el 5-nov); para los
--  días anteriores se usa la mejor marca que alguien hizo en ese reto.
--  Las semanas anteriores al 2-nov conservan el orden viejo, para que la
--  tabla coincida con el podio que ya se pagó.
--
--  La usan la app (ranking de la semana) y `close-week` (podio del dinero),
--  así que lo que ven los jugadores es lo que se paga.
-- ============================================================

create or replace function public.weekly_leaderboard(p_week date, p_limit int default 20)
returns table (player_id text, xp int, solves int, extra int, time_ms bigint, last_event timestamptz)
language sql security definer set search_path = public, pg_temp stable as $$
  with bounds as (
    select to_char(p_week, 'YYYYMMDD')::int as d0,
           to_char(p_week + 6, 'YYYYMMDD')::int as d1
  ),
  best as (  -- mejor marca de cada jugador en cada (día, nivel) de la semana
    select distinct on (lower(s.player_id), s.day, s.level)
      lower(s.player_id) as pid, s.day, s.level, s.countries, s.time_ms
    from public.scores s, bounds b
    where s.day between b.d0 and b.d1 and s.player_id is not null and s.player_id <> ''
    order by lower(s.player_id), s.day, s.level, s.countries asc, s.time_ms asc
  ),
  ref as (  -- ruta de referencia de cada reto
    select bt.day, bt.level, coalesce(min(dc.optimal), min(bt.countries)) as ref
    from best bt
    left join public.daily_challenges dc on dc.day = bt.day and dc.level = bt.level
    group by bt.day, bt.level
  ),
  daily as (
    select bt.pid,
           count(*)::int as solves,
           sum(greatest(bt.countries - r.ref, 0))::int as extra,
           sum(bt.time_ms)::bigint as time_ms
    from best bt join ref r on r.day = bt.day and r.level = bt.level
    group by bt.pid
  )
  select x.player_id, x.xp,
         coalesce(d.solves, 0), coalesce(d.extra, 0), coalesce(d.time_ms, 0)::bigint, x.last_event
  from public.weekly_xp x
  left join daily d on d.pid = lower(x.player_id)
  where x.week = p_week
  order by x.xp desc,
    case when p_week >= date '2026-11-02' then coalesce(d.solves, 0) end desc,
    case when p_week >= date '2026-11-02' then coalesce(d.extra, 0) end asc,
    case when p_week >= date '2026-11-02' then coalesce(d.time_ms, 0) end asc,
    x.last_event asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.weekly_leaderboard(date, int) from public;
grant execute on function public.weekly_leaderboard(date, int) to anon, authenticated, service_role;
