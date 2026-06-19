-- ============================================================
--  Frontle — Cron diario que cierra el ciclo (close-day)
--  Llama a la Edge Function close-day cada día a las 00:10 UTC,
--  poco después del cierre del día UTC. La función es idempotente.
--  Requiere los secrets OPERATOR_PRIVATE_KEY/GAME_ADDRESS fijados
--  en la Edge Function (si faltan, el cron corre pero la función
--  devuelve error sin efecto on-chain).
--  El Bearer es la anon/publishable key (pública, segura en repo).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reprogramable: si ya existe un job con este nombre, cron.schedule lo actualiza.
select cron.schedule(
  'frontle-close-day',
  '10 0 * * *',
  $$
  select net.http_post(
    url     := 'https://vrpaesidjdgmkicwlebi.supabase.co/functions/v1/close-day',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZycGFlc2lkamRnbWtpY3dsZWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDA2MTEsImV4cCI6MjA5NzMxNjYxMX0.L3Vnk0bCbuFcPOk5zRJ7qHJU6Im3IJIboAhrcUoQ6rc'
    ),
    body    := '{}'::jsonb
  );
  $$
);
