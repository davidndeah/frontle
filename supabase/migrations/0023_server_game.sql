-- ============================================================
--  Frontle — Reto diario generado y validado en el servidor
--
--  Hasta ahora el reto del día salía de una semilla pública (la fecha) y el
--  cliente calculaba y enviaba su propia marca: cualquiera podía conocer el
--  reto de antemano y mandar "2 países en 2.1 s" por la API sin jugar.
--
--  1. `daily_challenges`: el reto de cada (día, nivel), generado con números
--     aleatorios del servidor la primera vez que alguien lo pide. Privado:
--     solo lo lee la función `game`, que lo revela al abrir la partida.
--  2. `game_sessions`: cada partida abierta. Guarda la hora de inicio del
--     SERVIDOR; al cerrar, la función revalida la cadena de países contra el
--     grafo y calcula el tiempo con su propio reloj antes de escribir en
--     `scores`. `paid_tx` = pago on-chain que habilitó la partida (nivel
--     extra o reintento); único, para que un pago no sirva dos veces.
--
--  Todo con RLS y sin políticas: solo escribe y lee la función (service role).
-- ============================================================

create table if not exists public.daily_challenges (
  day            int  not null,                 -- YYYYMMDD (igual que scores.day)
  level          text not null check (level in ('easy', 'medium', 'hard')),
  start_country  text not null,
  end_country    text not null,
  optimal        int  not null,
  path           jsonb not null,
  created_at     timestamptz not null default now(),
  primary key (day, level)
);
alter table public.daily_challenges enable row level security;

create table if not exists public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_id    text not null check (player_id = lower(player_id)),
  day          int  not null,
  level        text not null check (level in ('easy', 'medium', 'hard')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  chain        jsonb,
  countries    int,
  time_ms      int,
  paid_tx      text unique,
  created_at   timestamptz not null default now()
);
create index if not exists game_sessions_player_day on public.game_sessions (player_id, day);
alter table public.game_sessions enable row level security;

comment on table public.daily_challenges is 'Reto diario secreto por (día, nivel), generado por la función game. Ver migración 0023.';
comment on table public.game_sessions is 'Partidas del reto diario abiertas/cerradas por la función game (hora de inicio del servidor). Ver migración 0023.';
