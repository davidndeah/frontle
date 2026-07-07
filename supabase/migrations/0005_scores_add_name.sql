-- Nombre de perfil elegido por el jugador (opcional).
-- El frontend lo envía con cada score; si es null, la UI muestra la wallet corta.
-- Nota: el front tiene fallback (reintenta sin `name`) mientras esta migración
-- no esté aplicada en prod.
alter table public.scores
  add column if not exists name text
  check (name is null or char_length(name) between 1 and 16);
