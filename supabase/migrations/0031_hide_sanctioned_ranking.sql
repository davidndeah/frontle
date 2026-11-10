-- ============================================================
--  Frontle — Las cuentas sancionadas no salen en los rankings
--
--  Hasta ahora (0021) las cuentas en revisión seguían saliendo en el ranking:
--  solo se les negaba el premio al cerrar. La semana 2967 las tres wallets
--  sancionadas por copiar respuestas (0030) volvieron a ocupar el top 3 de la
--  liga: los demás veían un podio que no iba a cobrar.
--
--  Ahora `daily_board` y `weekly_leaderboard` saltan a quien el cierre de ESE
--  periodo va a saltar (o saltó):
--    · sanción con block_prizes, del alcance que toca (diario: 'all';
--      liga: 'all' o 'weekly');
--    · ya existía al cerrar el periodo (created_at ≤ hora del cierre), y
--    · seguía vigente al cerrarlo (until null o > hora del cierre).
--  Cierres: close-day 00:10 UTC del día siguiente; close-week 00:20 UTC del
--  lunes siguiente. Así:
--    · el periodo en curso ya no los muestra;
--    · los periodos que cobraron antes de la sanción se ven como se pagaron
--      ("ganadores de la semana pasada" sigue cuadrando con weekly_winners);
--    · cuando la sanción vence, vuelven solos.
--  Ellos siguen viendo el aviso de revisión (is_under_review), que explica
--  por qué no aparecen. La cuenta del dueño (notify = false) sigue oculta
--  siempre, como en 0021.
-- ============================================================

create or replace function public.ranking_hidden(p_player text, p_weekly boolean, p_close timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_reviews a
     where a.player_id = lower(p_player)
       and a.block_prizes
       and (a.scope = 'all' or (p_weekly and a.scope = 'weekly'))
       and a.created_at <= p_close
       and (a.until is null or a.until > p_close)
  );
$$;

revoke all on function public.ranking_hidden(text, boolean, timestamptz) from public, anon, authenticated;

create or replace function public.daily_board(
  p_day int,
  p_level text,
  p_player text default null,
  p_limit int default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with best as (
    select distinct on (coalesce(nullif(s.player_id, ''), 'anon-' || s.id))
      s.id, s.day, s.countries, s.time_ms, s.country_code, s.player_id, s.level, s.name, s.created_at
    from public.scores s
    where s.day = p_day and s.level = p_level
      and not exists (
        select 1 from public.account_reviews a
         where a.player_id = lower(s.player_id) and not a.notify
      )
      and not public.ranking_hidden(
        s.player_id, false,
        (to_date(p_day::text, 'YYYYMMDD') + 1)::timestamp at time zone 'utc' + interval '10 minutes'
      )
    order by coalesce(nullif(s.player_id, ''), 'anon-' || s.id), s.countries, s.time_ms, s.created_at, s.id
  ),
  ranked as (
    select b.*, row_number() over (order by b.countries, b.time_ms, b.created_at, b.id)::int as rank
    from best b
  )
  select jsonb_build_object(
    'players', (select count(*) from ranked),
    'top', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.rank)
         from ranked r
        where r.rank <= least(greatest(coalesce(p_limit, 20), 1), 100)),
      '[]'::jsonb
    ),
    'me', (
      select to_jsonb(r)
        from ranked r
       where p_player is not null and lower(r.player_id) = lower(p_player)
       limit 1
    )
  );
$$;

create or replace function public.weekly_leaderboard(p_week date, p_limit integer default 20)
returns table(player_id text, xp integer, solves integer, extra integer, time_ms bigint, last_event timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
    and not public.ranking_hidden(
      x.player_id, true,
      (p_week + 7)::timestamp at time zone 'utc' + interval '20 minutes'
    )
  order by x.xp desc,
    case when p_week >= date '2026-11-02' then coalesce(d.solves, 0) end desc,
    case when p_week >= date '2026-11-02' then coalesce(d.extra, 0) end asc,
    case when p_week >= date '2026-11-02' then coalesce(d.time_ms, 0) end asc,
    x.last_event asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;
