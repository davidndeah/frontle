-- ============================================================
--  Frontle — Detección semanal de respuestas copiadas entre cuentas
--
--  La semana 2966 (2–8 nov-2026) el podio de la liga fueron tres wallets
--  (0x168a, 0x49a9, 0xcd77) que cada noche jugaban el diario en rotación:
--  la primera resolvía en 30–220 s y las otras dos mandaban la MISMA cadena
--  de países 1–3 min después en 4–20 s. Además se pasaban USDT entre ellas.
--  Los términos (punto 7) prohíben varias cuentas para manipular premios.
--
--  1. `account_reviews` gana duración y alcance:
--       · `until`  → la sanción vence sola (null = indefinida, como hasta hoy).
--       · `scope`  → 'all' (diario + semanal, lo de siempre) o 'weekly'
--                    (solo el podio de la liga).
--       · `source` → 'manual' o 'auto'. La detección nunca pisa una fila
--                    manual (p. ej. la cuenta del dueño).
--       · `evidence` → con quién copió y qué días.
--
--  2. `detect_answer_copying(semana)`: busca "copias rápidas" en
--     `game_sessions` de esa semana: misma cadena, mismo día y nivel,
--     empezada entre el inicio de la otra partida y 10 min después de que
--     terminara, más rápida que la original y en ≤ 25 s. Una pareja se marca
--     si tiene copias rápidas en ≥ 3 días distintos y ≥ 2 en medio/difícil
--     (el fácil coincide por azar: casi todos mandan la misma cadena).
--     Probada sobre la semana 2966: marca justo a las tres wallets y a nadie
--     más.
--
--  3. Sanción automática: `scope = 'weekly'` hasta el lunes siguiente al
--     cierre. El cron corre el lunes 00:05 UTC, antes de close-week (00:20),
--     así que la pareja pierde el podio de la semana en la que copió y vuelve
--     a competir la siguiente. El diario no se toca.
-- ============================================================

alter table public.account_reviews add column if not exists until timestamptz;
alter table public.account_reviews add column if not exists scope text not null default 'all';
alter table public.account_reviews add column if not exists source text not null default 'manual';
alter table public.account_reviews add column if not exists evidence jsonb;

alter table public.account_reviews drop constraint if exists account_reviews_scope_check;
alter table public.account_reviews add constraint account_reviews_scope_check check (scope in ('all', 'weekly'));
alter table public.account_reviews drop constraint if exists account_reviews_source_check;
alter table public.account_reviews add constraint account_reviews_source_check check (source in ('manual', 'auto'));

-- El aviso del cliente solo mientras la sanción esté vigente.
create or replace function public.is_under_review(p_player text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_reviews
     where player_id = lower(p_player) and notify and (until is null or until > now())
  );
$$;

-- p_week_start: lunes UTC de la semana a revisar (por defecto, la que acaba
-- de terminar). p_apply = false → solo devuelve lo que marcaría.
create or replace function public.detect_answer_copying(
  p_week_start date default ((date_trunc('week', now() at time zone 'utc'))::date - 7),
  p_apply boolean default true
)
returns table (player_id text, partners text[], days int, events int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  d0 int := to_char(p_week_start, 'YYYYMMDD')::int;
  d1 int := to_char(p_week_start + 6, 'YYYYMMDD')::int;
begin
  return query
  with s as (
    select lower(g.player_id) p, g.day, g.level, g.chain, g.started_at, g.finished_at, g.time_ms
      from game_sessions g
     where g.finished_at is not null and g.chain is not null and g.day between d0 and d1
  ),
  ev as (
    select a.p fuente, b.p copia, a.day, a.level
      from s a
      join s b on a.day = b.day and a.level = b.level and a.chain = b.chain and a.p <> b.p
             and b.started_at >= a.started_at
             and b.started_at <= a.finished_at + interval '10 minutes'
             and b.time_ms < a.time_ms
             and b.time_ms <= 25000
  ),
  pares as (
    select least(fuente, copia) w1, greatest(fuente, copia) w2,
           count(distinct day)::int dias, count(*)::int eventos
      from ev
     group by 1, 2
    having count(distinct day) >= 3 and count(*) filter (where level <> 'easy') >= 2
  ),
  marcadas as (
    select w, array_agg(distinct otro order by otro) socios, max(dias) dias, sum(eventos)::int eventos
      from (select w1 w, w2 otro, dias, eventos from pares
            union all
            select w2, w1, dias, eventos from pares) x
     group by w
  )
  select m.w, m.socios, m.dias, m.eventos from marcadas m;

  if p_apply then
    insert into account_reviews as ar (player_id, reason, block_prizes, notify, until, scope, source, evidence)
    select f.player_id,
           'auto ' || to_char(p_week_start, 'YYYY-MM-DD') || ': respuestas copiadas con '
             || array_to_string(f.partners, ', '),
           true, true,
           (p_week_start + 14)::timestamptz,
           'weekly', 'auto',
           jsonb_build_object('week_start', p_week_start, 'partners', f.partners, 'days', f.days, 'events', f.events)
      from detect_answer_copying(p_week_start, false) f
    on conflict (player_id) do update
       set reason   = excluded.reason,
           until    = greatest(ar.until, excluded.until),
           evidence = excluded.evidence
     where ar.source = 'auto';
  end if;
end;
$$;

revoke all on function public.detect_answer_copying(date, boolean) from public, anon, authenticated;

-- Lunes 00:05 UTC: antes de close-week (00:20), que ya salta a los marcados.
select cron.schedule(
  'frontle-detect-copying',
  '5 0 * * 1',
  $$ select public.detect_answer_copying(); $$
);

-- Las tres wallets de la semana 2966 (ya cobraron ese podio, no se puede
-- recuperar): sin premios, diario ni semanal, hasta después del cierre de la
-- semana 2967 (lunes 16-nov 00:20 UTC).
insert into public.account_reviews (player_id, reason, block_prizes, notify, until, scope, source, evidence) values
  ('0x168aeb540c18c3c0fbb283692751b92ade7c8448', '10-nov-2026: rotación con 0x49a9/0xcd77, cadenas copiadas en 4–20 s y USDT entre ellas', true, true, '2026-11-16 01:00+00', 'all', 'manual', '{"week_start":"2026-11-02","partners":["0x49a98dbd5766bf523bc23333a290b851f9658f00","0xcd775ec2057da93a0a7e6793183e04c204d89848"]}'),
  ('0x49a98dbd5766bf523bc23333a290b851f9658f00', '10-nov-2026: rotación con 0x168a/0xcd77, cadenas copiadas en 4–20 s y USDT entre ellas', true, true, '2026-11-16 01:00+00', 'all', 'manual', '{"week_start":"2026-11-02","partners":["0x168aeb540c18c3c0fbb283692751b92ade7c8448","0xcd775ec2057da93a0a7e6793183e04c204d89848"]}'),
  ('0xcd775ec2057da93a0a7e6793183e04c204d89848', '10-nov-2026: rotación con 0x168a/0x49a9; resuelve primero y las otras copian', true, true, '2026-11-16 01:00+00', 'all', 'manual', '{"week_start":"2026-11-02","partners":["0x168aeb540c18c3c0fbb283692751b92ade7c8448","0x49a98dbd5766bf523bc23333a290b851f9658f00"]}')
on conflict (player_id) do nothing;
