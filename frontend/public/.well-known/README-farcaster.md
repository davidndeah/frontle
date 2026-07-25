# Farcaster Mini App Manifest — Completar `accountAssociation`

## Estado actual

El archivo `farcaster.json` está creado con la estructura base del Mini App de Farcaster, pero **falta firmar la asociación de cuenta** (`accountAssociation`). Actualmente contiene campos vacíos:

⚠️ `iconUrl` apunta temporalmente a `bordy-m2.webp` (no hay un ícono cuadrado dedicado en `public/`, solo `icon.svg`). El spec de Farcaster pide un PNG 1024×1024 sin transparencia — conviene generar uno antes de publicar en el catálogo, aunque no bloquea la firma.

``json
"accountAssociation": {
  "header": "",
  "payload": "",
  "signature": ""
}
``

## Qué debe hacer David

Para completar el `accountAssociation`, necesitas firmar el dominio `www.frontle.earth` (el dominio canónico, ver `app/lib/site.ts`) con tu **FID de Farcaster** (tu cuenta de Warpcast) y tu **custody wallet** (la wallet asociada a tu cuenta). **No uses `frontle.vercel.app`**: es el dominio viejo, ya migrado.

### Opción 1: Usar Warpcast Mini App Manifest Tool (recomendado)

1. Ve a [Warpcast](https://warpcast.com) y asegúrate de estar autenticado con tu cuenta.
2. Abre la herramienta de manifest de Mini App de Farcaster (URL exacta: solicitar al equipo de Farcaster o buscar "Mini App manifest tool" en docs.farcaster.xyz).
3. En la herramienta:
   - Ingresa el dominio: `www.frontle.earth`
   - Dale a "Refresh" y confirma que `/.well-known/farcaster.json` responda 200 (solo pasará una vez esta rama esté mergeada y desplegada a producción)
   - Selecciona tu cuenta de Farcaster (FID)
   - La herramienta te pedirá firmar con tu custody wallet
4. La herramienta te generará tres valores:
   - `header` (estructura JSON con dominio, FID, etc.)
   - `payload` (datos codificados)
   - `signature` (la firma criptográfica de tu custody wallet)
5. Copia esos tres valores y actualiza `farcaster.json`.

### Opción 2: Firmarlo manualmente (si tienes acceso a tu custody wallet)

1. Construye el payload con tu FID y dominio.
2. Usa tu custody wallet privada para firmar el payload.
3. Formatea header, payload y signature según el spec de Farcaster.

## Pasos finales después de firmar

Una vez completes `accountAssociation`:

1. **Testea localmente:**
   ```bash
   cd frontend
   npm run dev
   # Verifica que GET /.well-known/farcaster.json devuelva JSON válido
   ```

2. **Verificación en producción:**
   - La app despliega automáticamente desde `main` a https://www.frontle.earth
   - Verifica que https://www.frontle.earth/.well-known/farcaster.json sea accesible (200, JSON válido) ANTES de firmar — la firma queda atada a ese dominio exacto

3. **Registro en catálogo de Farcaster:**
   - Una vez el manifest esté completo y firmado, puedes registrar Frontle en el catálogo oficial de Mini Apps de Farcaster (solicitar instrucciones en docs.farcaster.xyz o al equipo de Farcaster).

## Referencia: estructura de accountAssociation

Ejemplo de cómo se vería una firma completa:

``json
"accountAssociation": {
  "header": "{\"did\":\"did:farcaster:z6Mkod...\",\"name\":\"www.frontle.earth\",\"type\":\"ProofOfAccount\",\"version\":1}",
  "payload": "eJwLYWIEYWQFYWQFYWQFYWQFYWQFYWQF...",
  "signature": "0x7d8c42a5e1b4d9f2c6e8a1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1"
}
``

**No intentes falsificar estos valores.** Solo la herramienta de Farcaster (o tu wallet privada) puede generarlos correctamente.

## Preguntas

- **¿Cuál es mi FID?** — Aparece en tu perfil de Warpcast (número único de tu cuenta).
- **¿Dónde está mi custody wallet?** — Es la wallet con la que te registraste en Farcaster, almacenada en tu navegador/MiniPay o en una extensión de wallet.
- **¿Qué pasa si no firmo?** — El manifest funcionará parcialmente (se verá el icono y nombre), pero no será "verificado" en Farcaster, y algunos clientes pueden rechazarlo.
