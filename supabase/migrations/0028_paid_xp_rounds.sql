-- ============================================================
--  Frontle — Rondas pagadas con XP en los modos libres
--
--  Decisión del dueño (5-nov-2026): pasado el tope gratis de cada modo, el
--  jugador puede pagar una ronda con monedas (spend_attempt, 5 🪙) y esa ronda
--  SÍ da XP, hasta 3 rondas pagadas con XP por modo y día. Después se puede
--  seguir pagando para practicar, pero ya sin XP.
--
--  Topes de seq por fuente (gratis + 3 pagadas):
--    quiz_flag / quiz_outline   5 + 3 = 8   (2 XP cada una)
--    practice                   3 + 3 = 6   (5 XP)
--    region                     1 + 3 = 4   (10 XP)
--
--  El cobro lo hace la función `game` en `xp_start` (spend_coins con el
--  secreto del jugador, ref 'xp:<id de ronda>'), y solo una ronda marcada
--  `paid` puede otorgar un seq por encima del tope gratis.
-- ============================================================

alter table public.xp_rounds add column if not exists paid boolean not null default false;

alter table public.xp_events drop constraint if exists xp_shape;
alter table public.xp_events add constraint xp_shape check (
  (source = 'daily' and level in ('easy', 'medium', 'hard') and seq = 1
    and xp = case level when 'easy' then 10 when 'medium' then 20 else 30 end)
  or (source = 'stars' and level in ('easy', 'medium', 'hard') and seq = 1 and xp in (5, 10))
  or (source = 'nohints' and level in ('easy', 'medium', 'hard') and seq = 1 and xp = 5)
  or (source = 'streak_day' and level = '-' and seq = 1 and xp = 5)
  or (source = 'streak_milestone' and level in ('7', '30', '100') and seq = 1 and xp = 20)
  or (source = 'region' and level = '-' and seq between 1 and 4 and xp = 10)
  or (source = 'quiz_flag' and level = '-' and seq between 1 and 8 and xp = 2)
  or (source = 'quiz_outline' and level = '-' and seq between 1 and 8 and xp = 2)
  or (source = 'practice' and level = '-' and seq between 1 and 6 and xp = 5)
);

-- La función `game` cobra la ronda con el mismo RPC que usa la app.
grant execute on function public.spend_coins(text, text, text, text) to service_role;
