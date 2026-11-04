-- ============================================================
--  Frontle — El nombre solo se puede cambiar cada 7 días
--
--  El alias viaja en cada marca (`scores.name`) y hasta ahora se podía
--  cambiar en cada partida: la wallet 0x2ff1… pasó de "adam" a "kontolodon"
--  de un día para otro, y así cuesta reconocer a quien gana. Igual que en
--  TikTok o X, el nombre queda fijo 7 días tras cada cambio.
--
--  1. `player_names`: el nombre vigente de cada wallet y cuándo se fijó.
--     Se rellena con el último nombre que cada wallet usó en `scores`.
--  2. Trigger en `scores` (antes de insertar), la única vía por la que un
--     nombre llega a la base:
--       · sin registro            → se registra el nombre (primer nombre: libre);
--       · mismo nombre o sin name → se pone el vigente;
--       · nombre distinto:
--           - han pasado ≥ 7 días → se acepta y se reinicia el plazo;
--           - si no               → la marca entra igual, con el nombre VIGENTE.
--     No se rechaza la marca: perder la partida por el nombre sería peor.
--  3. `name_status(p_player)`: nombre vigente y desde cuándo se puede volver
--     a cambiar, para que la app lo diga antes de intentar el cambio.
-- ============================================================

create table if not exists public.player_names (
  player_id   text primary key check (player_id = lower(player_id)),
  name        text not null,
  changed_at  timestamptz not null default now()
);
alter table public.player_names enable row level security;

-- Relleno: último nombre de cada wallet; el plazo cuenta desde la primera vez
-- que lo usó (sin cortar las rachas: basta para arrancar).
insert into public.player_names (player_id, name, changed_at)
select l.pid, l.name, (
  select min(s2.created_at) from public.scores s2
   where lower(s2.player_id) = l.pid and s2.name = l.name
)
from (
  select distinct on (lower(s.player_id)) lower(s.player_id) as pid, s.name
  from public.scores s
  where s.name is not null and s.player_id ~* '^0x[0-9a-f]{40}$'
  order by lower(s.player_id), s.created_at desc
) l
on conflict (player_id) do nothing;

create or replace function public.scores_name_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pid text := lower(coalesce(new.player_id, ''));
  cur public.player_names%rowtype;
begin
  if pid !~ '^0x[0-9a-f]{40}$' then
    return new;
  end if;
  select * into cur from public.player_names where player_id = pid;
  if not found then
    if new.name is not null then
      insert into public.player_names (player_id, name) values (pid, new.name)
      on conflict (player_id) do nothing;
    end if;
    return new;
  end if;
  if new.name is null or new.name = cur.name then
    new.name := cur.name;
  elsif cur.changed_at <= now() - interval '7 days' then
    update public.player_names set name = new.name, changed_at = now() where player_id = pid;
  else
    new.name := cur.name;
  end if;
  return new;
end;
$$;

drop trigger if exists scores_name_cooldown on public.scores;
create trigger scores_name_cooldown
  before insert on public.scores
  for each row execute function public.scores_name_cooldown();

create or replace function public.name_status(p_player text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('name', n.name, 'next_change_at', n.changed_at + interval '7 days')
  from public.player_names n
  where n.player_id = lower(p_player);
$$;

revoke all on function public.name_status(text) from public;
grant execute on function public.name_status(text) to anon, authenticated;
