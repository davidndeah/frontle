-- ============================================================
--  Frontle — Bono de bienvenida (faucet) para usuarios nuevos por correo
--  Registra a quién ya se le entregó el bono de 0.10 USDT. Es el candado
--  anti-doble-cobro: dedupe por el DID de Privy (PK) y ademas unique por wallet.
--  La escribe SOLO la Edge Function `welcome-bonus` (service_role); no hay
--  politicas publicas.
-- ============================================================

create table if not exists public.welcome_bonus (
  privy_did      text        primary key,          -- id del usuario Privy (did:privy:...)
  wallet_address text        not null,             -- wallet embebida (minusculas)
  email          text,                             -- correo verificado (soporte/abuso)
  amount_raw     numeric     not null,             -- monto entregado (6 dec USDT)
  tx_hash        text,                             -- tx de la transferencia (null = reservado)
  created_at     timestamptz not null default now()
);

-- Una wallet no puede recibir dos bonos aunque cambie el DID.
create unique index if not exists welcome_bonus_wallet_idx on public.welcome_bonus (wallet_address);

alter table public.welcome_bonus enable row level security;
-- Sin politicas: solo la Edge Function con service_role escribe/lee.
