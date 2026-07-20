-- ============================================================
--  Frontle v2 — Cron semanal que cierra la liga (close-week)
--  Llama a la Edge Function close-week los LUNES a las 00:20 UTC, justo
--  después de que la semana cambie (y 10 min después del close-day de ese
--  día, para no pelear por el nonce del operator: ambas firman con la misma
--  wallet y dos tx simultáneas se pisarían).
--
--  La función es idempotente y, mientras WEEKLY_ADDRESS no esté configurada
--  (contrato sin desplegar), responde "skipped" sin tocar nada.
--  El Bearer es la anon/publishable key (pública, segura en repo).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'frontle-close-week',
  '20 0 * * 1',
  $$
  select net.http_post(
    url     := 'https://vrpaesidjdgmkicwlebi.supabase.co/functions/v1/close-week',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZycGFlc2lkamRnbWtpY3dsZWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDA2MTEsImV4cCI6MjA5NzMxNjYxMX0.L3Vnk0bCbuFcPOk5zRJ7qHJU6Im3IJIboAhrcUoQ6rc'
    ),
    body    := '{}'::jsonb
  );
  $$
);
