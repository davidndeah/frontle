-- ============================================================
--  Frontle — pistas y reintentos también en una sola confirmación
--
--  Igual que las monedas (0016): el pago del juego diario deja de ser
--  approve + payAttempt/buyHint y pasa a ser un `USDT.transfer` a la
--  tesorería. `credit-coins` (con kind = "daily") lo verifica y lo reenvía
--  al pot DIARIO de FrontleGame con `fundPot`, descontando la parte del
--  protocolo (protocolBps), que se queda en la tesorería — el mismo reparto
--  que hacía `_collect` en el contrato.
--
--  Para distinguir un pago del juego de una compra de monedas del mismo
--  monto, el cliente añade una etiqueta al final del calldata del transfer
--  (el token la ignora). Va firmada por el jugador: nadie puede tomar el
--  hash de otro y reclasificarlo.
--
--  La cola sigue siendo una sola tabla; `target` dice a qué pot va y
--  `purpose` qué se pagó (para /stats y auditoría).
-- ============================================================

alter table public.coin_pot_forwards
  add column if not exists target text not null default 'weekly'
    check (target in ('weekly', 'daily')),
  add column if not exists purpose text;

drop index if exists public.coin_pot_forwards_pending;
create index if not exists coin_pot_forwards_pending
  on public.coin_pot_forwards (target, created_at) where forwarded_tx is null;

comment on table public.coin_pot_forwards is
  'Cola de reenvío a los pots (semanal: compras de monedas; diario: pistas y reintentos) de los pagos por USDT.transfer a la tesorería (ver credit-coins, migraciones 0016 y 0017).';
