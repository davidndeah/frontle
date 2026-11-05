-- ============================================================
--  Frontle — Cerrar del todo los inserts con la clave pública
--
--  0024 y 0025 acotaron los inserts anon a "días ANTERIORES al corte"
--  (scores: day < 20261105, xp_events: day < 20261106). Eso dejaba abierta
--  la puerta hacia atrás: cualquiera podía seguir escribiendo marcas o XP de
--  días pasados — XP que todavía suma a la semana en curso, y marcas que
--  alargan la racha y los puntos. Ahora solo se acepta el DÍA EN CURSO
--  (UTC), y solo hasta el corte; pasado el corte la clave pública ya no
--  escribe nada y todo va por la función `game`.
-- ============================================================

drop policy if exists "anon insert" on public.scores;
create policy "anon insert" on public.scores
  for insert to anon
  with check (
    day < 20261105
    and day = to_char(now() at time zone 'utc', 'YYYYMMDD')::int
  );

drop policy if exists "xp_events_public_insert" on public.xp_events;
create policy "xp_events_public_insert"
  on public.xp_events for insert
  to anon, authenticated
  with check (
    player_id is not null and player_id <> ''
    and day < 20261106
    and day = to_char(now() at time zone 'utc', 'YYYYMMDD')::int
  );
