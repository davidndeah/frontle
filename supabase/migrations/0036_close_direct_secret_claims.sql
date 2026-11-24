-- ============================================================
--  Frontle — La clave pública ya no registra secrets directo
--
--  ⚠️ APLICAR SOLO cuando main (frontle.earth) ya tenga el cliente que
--  registra por la función `game` (lib/secret.ts → claim_secret) y la
--  función esté desplegada. Antes, las apps viejas que llaman a
--  claim_player_secret dejarían de poder gastar monedas.
--
--  Cierra la puerta que 0035 deja abierta por compatibilidad: con esto el
--  tope por IP de claim_secret es la única vía para registrar un secret.
-- ============================================================

-- PUBLIC también: Postgres le da EXECUTE por defecto a toda función.
revoke execute on function public.claim_player_secret(text, text) from public, anon, authenticated;
