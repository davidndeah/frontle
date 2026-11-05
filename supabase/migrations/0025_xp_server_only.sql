-- ============================================================
--  Frontle — El XP de la liga semanal lo escribe el servidor
--
--  Hasta ahora `xp_events` aceptaba inserts con la clave pública: los topes
--  y valores los fijaban los checks (0008), pero cualquiera podía mandar los
--  eventos del día sin jugar. Desde XP_SERVER_FROM los escribe la función
--  `game` con la service role:
--
--   · Reto diario (daily, stars, nohints, streak_day, streak_milestone): al
--     cerrar la partida (`finish`), con la cadena ya revalidada.
--   · Modos libres (quiz_flag, quiz_outline, practice, region): cada ronda
--     se abre en el servidor (`xp_start`) y se cierra (`xp_finish`) con un
--     tiempo mínimo medido con su reloj; la práctica además revalida la
--     cadena. El tope diario lo cuenta el servidor.
--
--  El día en curso al desplegar sigue aceptando la clave pública para que
--  las apps en caché no pierdan XP a mitad de día.
-- ============================================================

-- Rondas de los modos libres. Privada: sin políticas, solo la service role.
create table if not exists public.xp_rounds (
  id          uuid primary key default gen_random_uuid(),
  player_id   text not null check (player_id ~ '^0x[0-9a-f]{40}$'),
  day         int  not null,
  source      text not null check (source in ('quiz_flag', 'quiz_outline', 'practice', 'region')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists xp_rounds_player_day_idx on public.xp_rounds (player_id, day);
alter table public.xp_rounds enable row level security;

drop policy if exists "xp_events_public_insert" on public.xp_events;
create policy "xp_events_public_insert"
  on public.xp_events for insert
  to anon, authenticated
  with check (player_id is not null and player_id <> '' and day < 20261106);
