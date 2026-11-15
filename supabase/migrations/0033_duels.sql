-- ============================================================
--  Frontle — Duelos (1 contra 1)
--
--  Un jugador reta a otro a resolver EL MISMO reto. Gana quien use menos
--  países; a igualdad, menos tiempo (el mismo orden del ranking diario).
--
--  Todo pasa por la función `game` (service role), igual que el reto diario:
--    · el servidor genera el reto y no lo revela hasta que cada uno empieza;
--    · el reloj es el del servidor (inicio guardado aquí, fin = la petición);
--    · la cadena se revalida contra el grafo.
--  Así la marca de cada uno no se puede editar desde el cliente.
--
--  Ciclo de un duelo:
--    creado    → el retador lo está jugando (challenger_started_at)
--    enviado   → el retador terminó (sent_at); vence en 24 h (expires_at)
--    reclamado → el rival quedó asignado: elegido al crear, o el primero que
--                entra con el código (claimed_at)
--    terminado → el rival lo resolvió (finished_at + winner)
--  Si vence sin que el rival termine, queda en el historial como vencido.
--
--  XP (suma a la liga semanal, que paga USDT; por eso va con frenos):
--    ganar 5 · perder habiendo terminado 2 · empate 3 cada uno.
--    Solo cuando los DOS terminaron; como mucho 3 duelos con XP por jugador
--    y día UTC (creados o recibidos); contra el mismo rival, una vez al día;
--    nada para cuentas sancionadas. Crear: 3 duelos por jugador y día UTC.
--
--  `code`: 6 caracteres sin ambiguos (sin 0/O/1/I) para compartir a mano.
--  El deeplink de MiniPay no lleva parámetros, así que el código es lo que
--  lleva el duelo de un teléfono a otro.
-- ============================================================

create table if not exists public.duels (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  level                  text not null check (level in ('easy', 'medium', 'hard')),
  start_country          text not null,
  end_country            text not null,
  optimal                int  not null check (optimal > 0),

  challenger_id          text not null check (challenger_id ~ '^0x[0-9a-f]{40}$'),
  challenger_name        text check (challenger_name is null or length(challenger_name) between 1 and 16),
  challenger_started_at  timestamptz not null default now(),
  challenger_countries   int check (challenger_countries is null or challenger_countries > 0),
  challenger_time_ms     int check (challenger_time_ms is null or challenger_time_ms >= 2000),
  challenger_hints       int not null default 0 check (challenger_hints between 0 and 10),
  sent_at                timestamptz,
  expires_at             timestamptz,
  shared_at              timestamptz,

  rival_id               text check (rival_id is null or rival_id ~ '^0x[0-9a-f]{40}$'),
  rival_name             text check (rival_name is null or length(rival_name) between 1 and 16),
  claimed_at             timestamptz,
  rival_started_at       timestamptz,
  rival_countries        int check (rival_countries is null or rival_countries > 0),
  rival_time_ms          int check (rival_time_ms is null or rival_time_ms >= 2000),
  rival_hints            int not null default 0 check (rival_hints between 0 and 10),
  finished_at            timestamptz,
  winner                 text check (winner is null or winner in ('challenger', 'rival', 'tie')),
  -- XP que dejó el duelo a cada uno (0 si ya tenía el tope del día, si ya
  -- había sumado contra ese rival hoy o si está sancionado). Ver xp_shape.
  challenger_xp          int not null default 0 check (challenger_xp in (0, 2, 3, 5)),
  rival_xp               int not null default 0 check (rival_xp in (0, 2, 3, 5)),

  created_at             timestamptz not null default now(),
  check (rival_id is null or rival_id <> challenger_id),
  check ((sent_at is null) = (expires_at is null)),
  check (finished_at is null or (winner is not null and rival_time_ms is not null))
);

create index if not exists duels_rival_idx on public.duels (rival_id, expires_at);
create index if not exists duels_challenger_idx on public.duels (challenger_id, created_at);
create index if not exists duels_created_idx on public.duels (created_at);

alter table public.duels enable row level security;

-- La clave pública solo ve columnas del embudo: ni wallets, ni nombres, ni
-- el código, ni el reto. Mismo patrón que las demás vistas públicas
-- (security_invoker + RLS), con el permiso recortado por columna.
drop policy if exists duels_funnel_read on public.duels;
create policy duels_funnel_read on public.duels
  for select to anon, authenticated using (true);
revoke all on public.duels from anon, authenticated;
grant select (level, created_at, sent_at, shared_at, claimed_at, rival_started_at, finished_at, winner)
  on public.duels to anon, authenticated;

-- Embudo por día (UTC) de creación: cuántos duelos llegan a cada paso.
create or replace view public.duel_funnel
with (security_invoker = on) as
select
  (created_at at time zone 'utc')::date                         as day,
  count(*)                                                      as created,
  count(*) filter (where sent_at is not null)                   as sent,
  count(*) filter (where shared_at is not null)                 as shared,
  count(*) filter (where claimed_at is not null)                as claimed,
  count(*) filter (where rival_started_at is not null)          as played,
  count(*) filter (where finished_at is not null)               as finished,
  count(*) filter (where winner = 'rival')                      as rival_won
from public.duels
group by 1;

grant select on public.duel_funnel to anon, authenticated;

-- ------------------------------------------------------------
--  XP de duelos: fuente 'duel', seq 1..3 (el tope diario lo pone la PK) y
--  solo 5/3/2. Se rehace xp_shape completo (último cambio: 0028).
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
);
