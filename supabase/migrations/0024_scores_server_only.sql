-- ============================================================
--  Frontle — Desde el 5-nov-2026 las marcas del reto diario solo las
--  escribe el servidor
--
--  Con el reto en el servidor (0023), la función `game` revalida la cadena,
--  mide el tiempo y escribe en `scores` con la service role (que no pasa por
--  RLS). La política "anon insert" seguía dejando a cualquiera escribir con
--  la clave pública — la puerta por la que entraban las marcas inventadas.
--
--  Se acota a los días anteriores a SERVER_GAME_FROM (20261105): el día en
--  curso al desplegar sigue igual, y desde el corte la clave pública ya no
--  escribe marcas (ni la API directa ni apps viejas en caché, que jugarían
--  el reto antiguo y ensuciarían el ranking).
-- ============================================================

drop policy if exists "anon insert" on public.scores;
create policy "anon insert" on public.scores
  for insert to anon
  with check (day < 20261105);
