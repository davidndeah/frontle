-- ============================================================
--  Frontle — Reenvío a los pots por tandas (cada 4 h) + premio pendiente
--
--  Hasta ahora credit-coins reenviaba cada pago al pot en el momento: un
--  fundPot por pista de 0.05. Cada fundPot cuesta la misma comisión de red,
--  y con la entrada a MiniPay (~100 pagos/día) la operadora se quedó sin
--  saldo nativo y el 1-nov-2026 no cerró ni el día ni la semana.
--
--  1. Cron `frontle-flush-pots`: llama a credit-coins con {"flush": true} a
--     las :50 de las 03, 07, 11, 15, 19 y 23 UTC. Lo pendiente sale en UN
--     fundPot por pot. La tanda de las 23:50 va 10 min antes del corte del
--     día (fundPot suma al periodo EN CURSO) y 20 min antes del close-day
--     (00:10), así que no pelean por el nonce de la operadora.
--
--  2. Vista `pot_pending`: lo que espera en la cola, por pot. El premio que
--     ve el jugador = pot on-chain + pendiente, así su pago se refleja al
--     momento aunque el reenvío llegue horas después. Solo expone SUMAS (sin
--     hashes ni jugadores); corre con los permisos del dueño a propósito,
--     porque la tabla tiene RLS sin políticas de lectura.
--     Cuenta las filas sin reenviar y las "tomadas" por una tanda en curso
--     (claim:…); no las que ya tienen hash, que ya están en el contrato.
--
--  El Bearer es la anon/publishable key (pública, segura en repo), igual que
--  en 0002 y 0012.
-- ============================================================

create or replace view public.pot_pending as
select
  target,
  coalesce(sum(amount_wei), 0)::numeric(78, 0) as amount_wei
from public.coin_pot_forwards
where forwarded_tx is null or forwarded_tx like 'claim:%'
group by target;

grant select on public.pot_pending to anon, authenticated;

comment on view public.pot_pending is
  'USDT (6 dec) pendiente de reenviar a cada pot (daily/weekly). Lo suma el frontend al pot on-chain. Ver migración 0018.';

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'frontle-flush-pots',
  '50 3,7,11,15,19,23 * * *',
  $$
  select net.http_post(
    url     := 'https://vrpaesidjdgmkicwlebi.supabase.co/functions/v1/credit-coins',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZycGFlc2lkamRnbWtpY3dsZWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDA2MTEsImV4cCI6MjA5NzMxNjYxMX0.L3Vnk0bCbuFcPOk5zRJ7qHJU6Im3IJIboAhrcUoQ6rc'
    ),
    body    := '{"flush": true}'::jsonb
  );
  $$
);
