-- ============================================================
--  Frontle — Flag Rush (modo rotativo de banderas)
--
--  10 banderas con 4 opciones, un intento por ventana de 8 h (UTC): 00–08,
--  08–16 y 16–24. Reemplaza a "Adivina la bandera" cuando salga la interfaz.
--  Todo se decide en la función `game` (rush.ts / rush-core.ts): el servidor
--  elige las banderas (un set distinto por jugador), lleva el reloj y
--  califica. El cliente nunca recibe la respuesta antes de contestar.
--
--  XP (decisión del dueño, 16-nov-2026): cuentan los 2 mejores intentos del
--  día, hasta 6 XP cada uno → tope de 12 XP al día. Se guarda en unidades de
--  2 XP: fuente 'flag_rush', seq 1..6. El tope lo garantiza la clave primaria
--  de xp_events junto con xp_shape, igual que en las demás fuentes.
--
--  Orden: esta migración va DESPUÉS de 0033 (Duelos). Las dos rehacen
--  xp_shape completo; si 0033 se aplicara después de esta, borraría la línea
--  de 'flag_rush'. Por eso aquí ya viene incluida la línea de 'duel'.
-- ============================================================

create table if not exists public.rush_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_id    text not null check (player_id ~ '^0x[0-9a-f]{40}$'),
  day          int  not null check (day between 20260101 and 21001231),
  slot         int  not null check (slot between 0 and 2),
  -- [{a: respuesta, o: [4 opciones]}]. Solo lo lee la función (service role).
  questions    jsonb not null,
  -- [{c: elegida o null, ok, ms}], una por bandera contestada.
  answers      jsonb not null default '[]'::jsonb,
  idx          int  not null default 0 check (idx between 0 and 10),
  served_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  correct      int check (correct is null or correct between 0 and 10),
  time_ms      int check (time_ms is null or time_ms >= 0),
  -- XP de ESTE intento según aciertos (0 si la cuenta está sancionada). Lo
  -- que de verdad suma a la liga está en xp_events.
  xp           int  not null default 0 check (xp in (0, 2, 4, 6)),
  -- Casi perfecto y más rápido de lo que tarda una persona: para revisar a
  -- mano. No sanciona solo.
  suspect      boolean not null default false,
  -- Un intento por jugador y ventana.
  unique (player_id, day, slot),
  check ((finished_at is null) = (correct is null)),
  check ((finished_at is null) = (time_ms is null))
);

create index if not exists rush_sessions_open_idx on public.rush_sessions (player_id) where finished_at is null;
create index if not exists rush_sessions_day_idx on public.rush_sessions (day, slot);

alter table public.rush_sessions enable row level security;

-- La clave pública solo ve columnas del embudo: ni wallets, ni preguntas, ni
-- respuestas. Mismo patrón que duels (0033): security_invoker + RLS, con el
-- permiso recortado por columna.
drop policy if exists rush_funnel_read on public.rush_sessions;
create policy rush_funnel_read on public.rush_sessions
  for select to anon, authenticated using (true);
revoke all on public.rush_sessions from anon, authenticated;
grant select (day, slot, created_at, finished_at, correct, xp)
  on public.rush_sessions to anon, authenticated;

-- Embudo por día y ventana: cuántos intentos se abren, cuántos se terminan
-- y cómo les va.
create or replace view public.rush_funnel
with (security_invoker = on) as
select
  day,
  slot,
  count(*)                                             as started,
  count(*) filter (where finished_at is not null)      as finished,
  count(*) filter (where correct >= 5)                 as with_xp,
  count(*) filter (where correct >= 9)                 as top,
  round(avg(correct) filter (where finished_at is not null), 2) as avg_correct
from public.rush_sessions
group by 1, 2;

grant select on public.rush_funnel to anon, authenticated;

-- ------------------------------------------------------------
--  XP de Flag Rush: fuente 'flag_rush', seq 1..6, 2 XP cada unidad.
--  Se rehace xp_shape completo (último cambio: 0033, Duelos).
-- ------------------------------------------------------------
alter table public.xp_events drop constraint if exists xp_shape;
alter table public.xp_events add constraint xp_shape check (
  (source = 'daily' and level in ('easy', 'medium', 'hard') and seq = 1
    and xp = case level when 'easy' then 10 when 'medium' then 20 else 30 end)
  or (source = 'stars' and level in ('easy', 'medium', 'hard') and seq = 1 and xp in (5, 10))
  or (source = 'nohints' and level in ('easy', 'medium', 'hard') and seq = 1 and xp = 5)
  or (source = 'streak_day' and level = '-' and seq = 1 and xp = 5)
  or (source = 'streak_milestone' and level in ('7', '30', '100') and seq = 1 and xp = 20)
  or (source = 'region' and level = '-' and seq between 1 and 4 and xp = 10)
  or (source = 'quiz_flag' and level = '-' and seq between 1 and 8 and xp = 2)
  or (source = 'quiz_outline' and level = '-' and seq between 1 and 8 and xp = 2)
  or (source = 'practice' and level = '-' and seq between 1 and 6 and xp = 5)
  or (source = 'duel' and level = '-' and seq between 1 and 3 and xp in (2, 3, 5))
  or (source = 'flag_rush' and level = '-' and seq between 1 and 6 and xp = 2)
);
