-- ============================================================
--  0032 — landing_stats: jugadores de cualquier modo
--
--  La landing (/inicio) enseña "Jugadores". `public_stats.players` solo
--  cuenta a quien jugó el reto diario (sale de `scores`), y deja fuera a
--  quien solo ha jugado regiones, quiz o práctica. Esos modos dejan rastro
--  en `xp_events` (fuentes region / quiz_flag / quiz_outline / practice),
--  así que la cifra honesta es la unión de los dos.
--
--  Vista de solo lectura, sin datos por fila: devuelve un único número.
--  security_invoker para que respete las RLS de las tablas de origen (las
--  dos ya son legibles con la clave anónima).
-- ============================================================

create or replace view public.landing_stats
with (security_invoker = on) as
select count(*)::int as players
from (
  select player_id from public.scores
  union
  select player_id from public.xp_events
) as u;

grant select on public.landing_stats to anon, authenticated;
