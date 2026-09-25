-- ============================================================
--  Frontle — reenvío de compras de monedas al pot semanal
--
--  Feedback de MiniPay: comprar monedas pedía DOS confirmaciones (approve +
--  buyCoins). MiniPay no soporta signTypedData (sin permit) ni batching, así
--  que la única forma de una sola firma es un `USDT.transfer` a la tesorería
--  (el operador). `credit-coins` acredita las monedas y, con la llave del
--  operador, llama `fundPot` en FrontleWeekly para que el 100% siga yendo al
--  pot de la semana.
--
--  Esta tabla es la cola de ese reenvío. Una fila por compra (ref = tx hash):
--    forwarded_tx NULL          → pendiente de reenviar
--    forwarded_tx 'claim:<id>'  → una invocación la tomó y está enviando
--    forwarded_tx 0x…           → reenviada en esa tx de fundPot
--  El "tomar" es un UPDATE … WHERE forwarded_tx IS NULL: atómico por fila,
--  así dos invocaciones a la vez nunca reenvían la misma compra.
--
--  Solo la toca el service role (RLS sin políticas = anon no ve nada).
-- ============================================================

create table if not exists public.coin_pot_forwards (
  ref           text primary key,           -- tx hash de la compra
  amount_wei    numeric(78, 0) not null check (amount_wei > 0), -- USDT, 6 dec
  forwarded_tx  text,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists coin_pot_forwards_pending
  on public.coin_pot_forwards (created_at) where forwarded_tx is null;

alter table public.coin_pot_forwards enable row level security;
