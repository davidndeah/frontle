# Backend — Frontle

Capa 2 de la arquitectura. **Opcional para el MVP** (Kickoff: "La lógica — opcional para MVP").

Por ahora la mayor parte del juego corre en el frontend con datos estáticos (el grafo de fronteras es un JSON). Esta carpeta existe para separar desde el inicio lo que eventualmente necesitará servidor.

## Qué irá necesitando backend (lista para Bootcamp #2)

- [ ] **Validación del reto diario** — generar el par origen/destino del día de forma que todos vean el mismo (semilla por fecha UTC)
- [ ] **Leaderboard** — ranking diario de quién resolvió en menos países
- [ ] **Anti-trampa** — verificar server-side que la ruta enviada es válida y que no se manipuló el cliente
- [ ] **Persistencia de partidas** — historial del usuario (puede resolverse con Supabase como el tutor)
- [ ] **Sincronía con el contrato** — escuchar eventos de pago (`AttemptPurchased`, `HintPurchased`)

## Nota

El tutor (freaking-grammar) usa **Supabase** para esto + rutas API dentro del propio Next.js (`src/app/api/...`). Para Frontle podemos empezar igual: rutas API en el frontend de Next.js y mover a backend dedicado solo si crece.
