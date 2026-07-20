-- ============================================================
--  Frontle v2 — Fase 4: histórico del podio semanal
--
--  Espejo de `winners` (el del reto diario) para la liga. Lo escribe SOLO la
--  edge function `close-week` con el service role; el cliente solo lee, para
--  mostrar "los ganadores de la semana pasada".
--
--  OJO a los DOS números de semana (mismo tropiezo que los dos "días" de v1):
--   · `week`       = índice del contrato ((timestamp/1 día + 3) / 7).
--   · `week_start` = lunes UTC en formato fecha, que es la clave de la vista
--                    `weekly_xp`. Guardamos los dos para no re-derivarlos.
-- ============================================================

create table if not exists public.weekly_winners (
  week           int  not null,
  place          int  not null check (place between 1 and 3),
  week_start     date not null,
  winner_address text not null check (winner_address <> ''),
  xp             int  not null,
  pot_raw        text not null,
  roll_tx        text,
  created_at     timestamptz not null default now(),
  primary key (week, place)
);

create index if not exists weekly_winners_start_idx on public.weekly_winners (week_start);

alter table public.weekly_winners enable row level security;

-- Lectura pública (la UI enseña el podio de la semana cerrada).
drop policy if exists "weekly_winners_public_read" on public.weekly_winners;
create policy "weekly_winners_public_read"
  on public.weekly_winners for select
  using (true);

-- Sin política de insert: solo el service role (close-week) escribe aquí.

grant select on public.weekly_winners to anon, authenticated;
