-- ============================================================
--  Frontle — Registro del secret con tope por IP y recuperación sin compra
--
--  `claim_player_secret` (0010) se podía llamar con la clave pública para
--  cualquier wallet: primera escritura gana, sin prueba de dueño. Un script
--  registraba el secret de wallets ajenas (salen en el ranking) y las dejaba
--  sin gastar monedas ni jugar Flag Rush; recuperarlas exigía comprar.
--
--  Ahora el registro va por la función `game` (identity.ts):
--    · claim_secret: tope de registros NUEVOS por IP y hora (secret_claims).
--    · recover_secret: un transfer de 0 USDT etiquetado prueba que la wallet
--      es tuya y rota el secret; cada tx sirve una vez (secret_proofs).
--
--  Solo la función (service role) toca estas tablas. Quitarle el permiso a
--  la clave pública sobre claim_player_secret va aparte, en 0036, porque
--  rompe a las apps que lo llaman directo: aplicar cuando main tenga el
--  cliente nuevo.
-- ============================================================

create table if not exists public.secret_claims (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  player_id   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists secret_claims_ip_idx on public.secret_claims (ip_hash, created_at);

create table if not exists public.secret_proofs (
  tx          text primary key check (tx ~ '^0x[0-9a-f]{64}$'),
  player_id   text not null,
  created_at  timestamptz not null default now()
);

alter table public.secret_claims enable row level security;
alter table public.secret_proofs enable row level security;
revoke all on public.secret_claims from anon, authenticated;
revoke all on public.secret_proofs from anon, authenticated;
