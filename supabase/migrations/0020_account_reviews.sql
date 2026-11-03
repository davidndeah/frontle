-- ============================================================
--  Frontle — Cuentas en revisión + tiempo mínimo validado en servidor
--
--  El 3-nov-2026 tres wallets (un mismo grupo) marcaban los 3 niveles en
--  1.2–2.8 s sin haber pagado nunca nada, y una de ellas se llevaba el pot
--  entero varios días seguidos. Las marcas se insertan desde el cliente con
--  la clave pública, así que el servidor tiene que poner los límites:
--
--  1. `scores_removed`: copia de las marcas que se quitan a mano (auditoría).
--     Se creó al vuelo el 3-nov; aquí queda declarada.
--
--  2. `scores_min_time`: ninguna marca por debajo de 2 s. Es un CHECK en la
--     tabla, así que vale aunque alguien llame a la API sin pasar por la app.
--     NOT VALID: no toca las marcas históricas, solo las nuevas.
--
--  3. `account_reviews`: wallets que el equipo está revisando. Siguen jugando
--     y apareciendo en el ranking, pero mientras `block_prizes` sea true el
--     cierre diario/semanal las salta al elegir ganador. Sin políticas de
--     lectura: la lista no es pública.
--
--  4. `is_under_review(p_player)`: lo único que ve el cliente — un booleano
--     para SU wallet, para enseñar el aviso de revisión.
-- ============================================================

create table if not exists public.scores_removed (like public.scores including defaults);
alter table public.scores_removed add column if not exists removed_at timestamptz default now();
alter table public.scores_removed add column if not exists removed_reason text;
alter table public.scores_removed enable row level security;

alter table public.scores drop constraint if exists scores_min_time;
alter table public.scores add constraint scores_min_time check (time_ms >= 2000) not valid;

create table if not exists public.account_reviews (
  player_id     text primary key check (player_id = lower(player_id)),
  reason        text,
  block_prizes  boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.account_reviews enable row level security;

create or replace function public.is_under_review(p_player text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.account_reviews where player_id = lower(p_player));
$$;

revoke all on function public.is_under_review(text) from public;
grant execute on function public.is_under_review(text) to anon, authenticated;

insert into public.account_reviews (player_id, reason) values
  ('0x2ff10a4748902e82e82835edef6d98c306e4ba38', '3-nov-2026: 1.2 s en medio y difícil; grupo con 0x3055/0x3c83'),
  ('0x305534f69ef904073323c925eac4f5faa33a7e2e', '3-nov-2026: 2.7 s en los 3 niveles en 25 s; sin actividad on-chain'),
  ('0x3c83b87007a5d2226cca802bf41d5b994313cd66', '3-nov-2026: mismo patrón que 0x2ff1/0x3055; sin actividad on-chain')
on conflict (player_id) do nothing;

-- Cuentas que no compiten por premio sin estar bajo sospecha (la del dueño):
-- `notify = false` → el cierre las salta igual, pero no ven el aviso.
alter table public.account_reviews add column if not exists notify boolean not null default true;

create or replace function public.is_under_review(p_player text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.account_reviews where player_id = lower(p_player) and notify);
$$;

insert into public.account_reviews (player_id, reason, notify) values
  ('0x14790f4aa4d855c5949bf80adddb599126d56c12', 'cuenta del dueño: no compite por premio', false)
on conflict (player_id) do nothing;
