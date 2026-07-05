-- ============================================================
--  Frontle — Niveles: `winners` pasa a PK compuesta (day, level)
--  A partir del FrontleGame v2 hay 3 ganadores por día (fácil/medio/difícil).
--  La Edge Function `close-day` registra hasta 3 filas por día. La fuente de
--  verdad para reclamar sigue siendo el contrato (winnerOf/prize/claimed por
--  (día, nivel)); esta tabla es solo un índice para la UI.
--
--  ⚠️ Aplicar JUNTO al deploy del FrontleGame v2 y el redeploy de `close-day`
--     (el nuevo close-day firma rollDay(day,hard,med,easy), que solo existe en v2).
-- ============================================================

-- 1) Columna de nivel (las 6 filas viejas quedan 'medium').
alter table public.winners
  add column if not exists level text not null default 'medium'
    check (level in ('easy', 'medium', 'hard'));

-- 2) PK compuesta (day, level): un ganador por nivel por día.
alter table public.winners drop constraint if exists winners_pkey;
alter table public.winners add primary key (day, level);
