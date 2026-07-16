-- ============================================================
--  Frontle — Persistencia de progreso del jugador (racha, puntos, logros)
--  Backend de la gamificación del plan tabs+gamificación (GAM-2/3/5 🔶).
--
--  Dos piezas, dos modelos:
--
--  · `player_progress` (vista): racha y puntos se DERIVAN de `scores`,
--    nunca los asevera el cliente — no se puede inflar la racha con un
--    POST. Puntos v1: 10 por cada (día, nivel) resuelto — la recompensa
--    "resolviste aunque no ganaste el pot" de GAM-5.
--
--  · `achievements` (tabla): los logros que el servidor NO puede derivar
--    (ruta óptima, puente continental usan la cadena jugada, que no se
--    guarda en `scores`) los inserta el cliente con la anon key — el
--    mismo modelo de confianza que ya rige `scores`. Insert-only: sin
--    políticas de update/delete, un logro no se puede "des-desbloquear"
--    ni pisar su fecha.
--
--  NO aplicada en prod todavía (el front degrada en silencio sin ella).
-- ============================================================

-- --- Logros ----------------------------------------------------------------
create table if not exists public.achievements (
  player_id   text not null,
  id          text not null check (id in (
    'firstWin', 'optimalRoute', 'twoContinents', 'streak3', 'streak7', 'hardSolved'
  )),
  unlocked_at timestamptz not null default now(),
  primary key (player_id, id)
);

alter table public.achievements enable row level security;

-- Lectura pública (la UI consulta sin auth, igual que `scores`).
drop policy if exists "achievements_public_read" on public.achievements;
create policy "achievements_public_read"
  on public.achievements for select
  using (true);

-- Insert con la anon key. Sin update/delete: insert-only por diseño.
drop policy if exists "achievements_public_insert" on public.achievements;
create policy "achievements_public_insert"
  on public.achievements for insert
  with check (player_id is not null and player_id <> '');

-- --- Progreso derivado (racha + puntos) -------------------------------------
-- `security_invoker = on`: la vista respeta la RLS de quien consulta; `anon`
-- ve exactamente lo que ya podía ver en `scores` (que expone player_id).
--
-- Racha = días UTC consecutivos con al menos una marca, contando el run que
-- termina hoy o ayer (ayer cuenta: el reto de hoy puede seguir pendiente sin
-- romper la racha en pantalla). `scores.day` es YYYYMMDD, no el día del
-- contrato — se convierte a date real para que los saltos de mes no corten
-- el run (20260731 → 20260801 SÍ son consecutivos).
drop view if exists public.player_progress;

create view public.player_progress
with (security_invoker = on) as
with days as (
  select distinct player_id, to_date(day::text, 'YYYYMMDD') as d
  from public.scores
  where player_id is not null and player_id <> ''
),
runs as (
  -- Truco clásico de islas: día - fila_n es constante dentro de un run
  -- de días consecutivos.
  select player_id, count(*) as len, max(d) as last_d
  from (
    select player_id, d,
           d - (row_number() over (partition by player_id order by d))::int as grp
    from days
  ) g
  group by player_id, grp
),
plays as (
  select
    player_id,
    count(distinct day)::int          as days_played,
    count(distinct (day, level))::int as solves
  from public.scores
  where player_id is not null and player_id <> ''
  group by player_id
)
select
  p.player_id,
  p.days_played,
  p.solves * 10 as points,
  coalesce((
    select r.len from runs r
    where r.player_id = p.player_id
      and r.last_d >= (now() at time zone 'utc')::date - 1
    order by r.last_d desc
    limit 1
  ), 0)::int as streak
from plays p;

-- --- Permisos ----------------------------------------------------------------
grant select on public.player_progress to anon, authenticated;
grant select, insert on public.achievements to anon, authenticated;
