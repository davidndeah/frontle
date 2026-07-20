-- ============================================================
--  Frontle v2 — Fase 1: eventos de XP y liga semanal (PLAN-FRONTLE-V2 §4)
--
--  `xp_events` es insert-only con la anon key — el MISMO modelo de confianza
--  de `scores` y `achievements`. La diferencia: los topes diarios y los
--  valores de XP van en constraints, así el cliente no puede inflar nada:
--
--  · El VALOR de cada evento lo fija el check `xp_shape` por fuente — un
--    POST con xp=999 se rechaza.
--  · El TOPE por día lo fija la primary key (player, day, source, level, seq)
--    más el rango de `seq` permitido por fuente — el 6º acierto de quiz del
--    día (seq=6) viola el check; repetir seq viola la PK.
--
--  La vista `weekly_xp` agrega por semana ISO (lunes UTC, igual que el ciclo
--  del plan). El ranking se ordena por xp desc y desempata por quien llegó
--  antes (last_event asc) — spec §3.2.
-- ============================================================

create table if not exists public.xp_events (
  player_id  text not null,
  -- Mismo formato YYYYMMDD (UTC) de `scores.day`. NO es el día del contrato.
  day        int  not null check (day between 20250101 and 21001231),
  source     text not null,
  -- `level`: nivel del diario, o el hito de racha, o '-' si no aplica.
  level      text not null default '-',
  -- `seq`: contador dentro del día para fuentes con tope > 1.
  seq        int  not null default 1,
  xp         int  not null,
  created_at timestamptz not null default now(),
  primary key (player_id, day, source, level, seq),
  constraint xp_shape check (
    -- Reto diario resuelto: XP por nivel (10/20/30), una vez por nivel/día.
    (source = 'daily' and level in ('easy', 'medium', 'hard') and seq = 1
      and xp = case level when 'easy' then 10 when 'medium' then 20 else 30 end)
    -- Calidad de la solución (estrellas): +10 óptima, +5 a un país. Una vez
    -- por nivel/día — mejorar la marca en un reintento no re-paga el bonus.
    or (source = 'stars' and level in ('easy', 'medium', 'hard') and seq = 1 and xp in (5, 10))
    -- Sin pistas: +5 por nivel/día.
    or (source = 'nohints' and level in ('easy', 'medium', 'hard') and seq = 1 and xp = 5)
    -- Racha mantenida (resolver el diario del día): +5, 1/día.
    or (source = 'streak_day' and level = '-' and seq = 1 and xp = 5)
    -- Hito de racha (7/30/100): +20 al ALCANZARLO. Re-alcanzarlo tras perder
    -- la racha vuelve a pagar (hay que reconstruirla entera — diseño Duolingo).
    or (source = 'streak_milestone' and level in ('7', '30', '100') and seq = 1 and xp = 20)
    -- Regiones: completar un país, +10, máx 1 país con XP/día.
    or (source = 'region' and level = '-' and seq = 1 and xp = 10)
    -- Quizzes: +2 por acierto, máx 5 aciertos con XP/día por modo (10 XP).
    or (source = 'quiz_flag' and level = '-' and seq between 1 and 5 and xp = 2)
    or (source = 'quiz_outline' and level = '-' and seq between 1 and 5 and xp = 2)
    -- Práctica: +5 por reto resuelto, máx 3/día (15 XP).
    or (source = 'practice' and level = '-' and seq between 1 and 3 and xp = 5)
  )
);

-- Consultas de la liga: la semana de un día concreto, y el total del jugador.
create index if not exists xp_events_day_idx on public.xp_events (day);
create index if not exists xp_events_player_idx on public.xp_events (player_id);

alter table public.xp_events enable row level security;

-- Lectura pública (el ranking semanal se muestra sin auth, igual que `scores`).
drop policy if exists "xp_events_public_read" on public.xp_events;
create policy "xp_events_public_read"
  on public.xp_events for select
  using (true);

-- Insert con la anon key. Sin update/delete: el XP no se edita ni se borra.
drop policy if exists "xp_events_public_insert" on public.xp_events;
create policy "xp_events_public_insert"
  on public.xp_events for insert
  with check (player_id is not null and player_id <> '');

-- --- Vista semanal -----------------------------------------------------------
-- Semana ISO con inicio lunes (date_trunc('week') en Postgres es lunes),
-- alineada con el ciclo "lunes 00:00 UTC → domingo 23:59 UTC" del plan.
drop view if exists public.weekly_xp;

create view public.weekly_xp
with (security_invoker = on) as
select
  player_id,
  (date_trunc('week', to_date(day::text, 'YYYYMMDD')))::date as week,
  sum(xp)::int as xp,
  max(created_at) as last_event
from public.xp_events
group by player_id, 2;

grant select on public.weekly_xp to anon, authenticated;
grant select, insert on public.xp_events to anon, authenticated;
