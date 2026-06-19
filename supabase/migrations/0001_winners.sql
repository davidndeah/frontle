-- ============================================================
--  Frontle — Tabla de ganadores del ciclo diario
--  La llena la Edge Function `close-day` tras cerrar el día on-chain
--  (rollDay). Es un ÍNDICE de conveniencia para la UI: la fuente de
--  verdad para reclamar sigue siendo el contrato (winnerOf/rolled/claimed).
-- ============================================================

create table if not exists public.winners (
  day            bigint      primary key,          -- índice de día UTC (= currentDay del contrato)
  winner_address text        not null,             -- dirección ganadora (minúsculas)
  pot_raw        numeric     not null default 0,   -- pot en unidades mínimas del token (6 dec USDT)
  countries      int,                              -- marca ganadora (para mostrar)
  time_ms        bigint,                           -- tiempo de la marca ganadora
  roll_tx        text,                             -- hash de la tx rollDay
  claimed        boolean     not null default false,-- espejo on-chain (la UI lo confirma contra el contrato)
  created_at     timestamptz not null default now()
);

create index if not exists winners_winner_idx on public.winners (winner_address);

-- RLS: lectura pública (la UI consulta sin auth). La escritura la hace la
-- Edge Function con la service_role key, que ignora RLS.
alter table public.winners enable row level security;

drop policy if exists "winners_public_read" on public.winners;
create policy "winners_public_read"
  on public.winners for select
  using (true);
