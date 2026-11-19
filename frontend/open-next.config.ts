// Configuración de OpenNext para desplegar Frontle en Cloudflare Workers.
//
// Caché incremental en Workers KV (gratis, sin tarjeta): lo usa
// `unstable_cache` de app/inicio/LiveFacts.tsx para no consultar Blockscout y
// Supabase en cada visita a la landing (se refresca una vez al día).
// Cola "direct": la revalidación ocurre en la misma petición; con un único
// dato diario no hace falta una cola con Durable Objects.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: "direct",
});
