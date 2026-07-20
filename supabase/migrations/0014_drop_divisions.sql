-- ============================================================
--  Frontle v2 — Se retiran las divisiones (decisión de producto)
--
--  Con el volumen de jugadores actual, partir la liga en 4 divisiones dejaba
--  cohortes de una o dos personas: sin competencia real y con el pot yendo a
--  una división casi vacía. Se vuelve a **un solo ranking semanal global**:
--  se reinicia cada semana y premia a los 3 primeros por XP.
--
--  Lo que se retira (0013): `league_divisions`, `tier_of`, `weekly_board` y
--  `close_week_divisions`. Lo que SE MANTIENE de la 0013: la wallet
--  obligatoria para competir (los checks de dirección en `xp_events` y
--  `coin_ledger`), que es regla de producto vigente.
--
--  El código sigue en el historial de git (migración 0013 + commit c47f44d)
--  por si las divisiones vuelven cuando haya volumen.
-- ============================================================

-- El podio del dinero vuelve a ser el top 3 GLOBAL de la semana.
-- Desempate: a igual XP gana quien lo alcanzó antes (PLAN §3.2).
-- (DROP antes de crear: cambia el tipo de retorno, ya no lleva `tier`.)
drop function if exists public.weekly_podium(date);

create function public.weekly_podium(p_week date)
returns table (player_id text, xp int)
language sql security definer set search_path = public, pg_temp stable as $$
  select x.player_id, x.xp
  from public.weekly_xp x
  where x.week = p_week
  order by x.xp desc, x.last_event asc
  limit 3;
$$;

drop function if exists public.close_week_divisions(date);
drop view if exists public.weekly_board;
drop function if exists public.tier_of(text, date);
drop table if exists public.league_divisions;

grant execute on function public.weekly_podium(date) to anon, authenticated;
