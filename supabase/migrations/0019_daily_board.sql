-- ============================================================
--  Frontle — Ranking diario resuelto en la base (top N + mi puesto)
--
--  Hasta ahora el cliente bajaba TODAS las marcas de (día, nivel) —hasta
--  1000 filas— para deduplicar por jugador, cortar el top 20 y encontrar el
--  puesto propio. Con la entrada a MiniPay eso crece al cuadrado: más
--  jugadores = tablas más largas × más gente descargándolas, y el egress
--  del plan gratuito no aguanta mucho más de ~400 jugadores/día.
--
--  `daily_board` hace lo mismo aquí y devuelve solo lo que se pinta:
--    { players: n, top: [filas 1..p_limit], me: fila propia con su puesto | null }
--
--  Criterio IDÉNTICO al de `bestPerPlayer` en frontend/app/lib/ranking.ts:
--  una fila por jugador (su mejor marca: menos países, luego menos tiempo) y
--  orden global por países y tiempo. El desempate final (created_at, id) lo
--  fija para que dos consultas den siempre el mismo puesto. Las filas sin
--  player_id cuentan como jugadores distintos, igual que en el cliente.
--
--  Corre con los permisos de quien llama (security invoker): `scores` ya es
--  legible para anon, no expone nada nuevo. p_limit va acotado a 100.
-- ============================================================

create or replace function public.daily_board(
  p_day int,
  p_level text,
  p_player text default null,
  p_limit int default 20
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with best as (
    select distinct on (coalesce(nullif(s.player_id, ''), 'anon-' || s.id))
      s.id, s.day, s.countries, s.time_ms, s.country_code, s.player_id, s.level, s.name, s.created_at
    from public.scores s
    where s.day = p_day and s.level = p_level
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

grant execute on function public.daily_board(int, text, text, int) to anon, authenticated;

comment on function public.daily_board(int, text, text, int) is
  'Ranking diario de (día YYYYMMDD, nivel): total de jugadores, top N y la fila del jugador con su puesto. Ver migración 0019.';
