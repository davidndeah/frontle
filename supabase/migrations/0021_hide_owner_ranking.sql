-- ============================================================
--  Frontle — Ocultar del ranking diario las cuentas que no compiten
--
--  Las cuentas de account_reviews con notify = false (la del dueño) no
--  cobran premio (0020). Si además salen en el ranking, el jugador ve a
--  alguien 1º y el premio se lo lleva el 2º: confunde. `daily_board` las
--  salta. Las cuentas en revisión (notify = true) SÍ siguen saliendo: el
--  aviso les dice que pueden seguir jugando con normalidad.
--
--  account_reviews no es legible para anon, así que la función pasa a
--  security definer. Solo lee `scores` (ya pública) y devuelve lo mismo que
--  antes; la lista de cuentas no sale en ninguna parte.
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

revoke all on function public.daily_board(int, text, text, int) from public;
grant execute on function public.daily_board(int, text, text, int) to anon, authenticated;
