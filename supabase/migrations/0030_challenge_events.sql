-- ============================================================
--  Frontle — "¿Me ganas?": medición del reto entre amigos
--
--  Cuenta el embudo del link compartible de Práctica (lib/challenge.ts):
--    share  quien gana comparte el reto
--    open   alguien llega por el link
--    play   empieza el reto
--    solve  lo resuelve (con su resultado: win / lose / tie)
--
--  Solo escribe la función `game` (service role, acción challenge_event).
--  La clave pública no lee ni escribe la tabla cruda: solo la vista
--  agregada `challenge_funnel`. Un evento por (tipo, semilla, cliente),
--  así tocar dos veces o recargar no infla nada. `client_id` es un id
--  anónimo del navegador; `player_id`, la wallet si estaba conectada.
-- ============================================================

create table if not exists public.challenge_events (
  id          bigint generated always as identity primary key,
  kind        text   not null check (kind in ('share', 'open', 'play', 'solve')),
  seed        bigint not null check (seed between 1000000000 and 2147483646),
  level       text   not null check (level in ('easy', 'medium', 'hard')),
  client_id   text   not null check (client_id ~ '^[a-z0-9-]{8,40}$'),
  player_id   text   check (player_id is null or player_id ~ '^0x[0-9a-f]{40}$'),
  result      text   check (result is null or (kind = 'solve' and result in ('win', 'lose', 'tie'))),
  created_at  timestamptz not null default now(),
  unique (kind, seed, client_id)
);
create index if not exists challenge_events_created_idx on public.challenge_events (created_at);
create index if not exists challenge_events_client_idx on public.challenge_events (client_id, created_at);
alter table public.challenge_events enable row level security;

-- Embudo por día (UTC). `links_*` cuenta retos distintos, no personas.
create or replace view public.challenge_funnel as
select
  (created_at at time zone 'utc')::date               as day,
  count(*) filter (where kind = 'share')              as shares,
  count(*) filter (where kind = 'open')               as opens,
  count(*) filter (where kind = 'play')               as plays,
  count(*) filter (where kind = 'solve')              as solves,
  count(*) filter (where kind = 'solve' and result = 'win') as solves_won,
  count(distinct seed) filter (where kind = 'share')  as links_shared,
  count(distinct seed) filter (where kind = 'open')   as links_opened
from public.challenge_events
group by 1;

grant select on public.challenge_funnel to anon, authenticated;
