# Farcaster Mini App Manifest — Completar `accountAssociation`

## Estado actual

El archivo `farcaster.json` está creado con la estructura base del Mini App de Farcaster, pero **falta firmar la asociación de cuenta** (`accountAssociation`). Actualmente contiene campos vacíos:

``json
"accountAssociation": {
  "header": "",
  "payload": "",
  "signature": ""
}
``

## Qué debe hacer David

Para completar el `accountAssociation`, necesitas firmar el dominio `frontle.vercel.app` con tu **FID de Farcaster** (tu cuenta de Warpcast) y tu **custody wallet** (la wallet asociada a tu cuenta).

### Opción 1: Usar Warpcast Mini App Manifest Tool (recomendado)

1. Ve a [Warpcast](https://warpcast.com) y asegúrate de estar autenticado con tu cuenta.
2. Abre la herramienta de manifest de Mini App de Farcaster (URL exacta: solicitar al equipo de Farcaster o buscar "Mini App manifest tool" en docs.farcaster.xyz).
3. En la herramienta:
   - Ingresa el dominio: `frontle.vercel.app`
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
   - La app ya despliega automáticamente desde `main` a https://frontle.vercel.app
   - Verifica que https://frontle.vercel.app/.well-known/farcaster.json sea accesible

3. **Registro en catálogo de Farcaster:**
   - Una vez el manifest esté completo y firmado, puedes registrar Frontle en el catálogo oficial de Mini Apps de Farcaster (solicitar instrucciones en docs.farcaster.xyz o al equipo de Farcaster).

## Referencia: estructura de accountAssociation

Ejemplo de cómo se vería una firma completa:

``json
"accountAssociation": {
  "header": "{\"did\":\"did:farcaster:z6Mkod...\",\"name\":\"frontle.vercel.app\",\"type\":\"ProofOfAccount\",\"version\":1}",
  "payload": "eJwLYWIEYWQFYWQFYWQFYWQFYWQFYWQF...",
  "signature": "0x7d8c42a5e1b4d9f2c6e8a1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1"
}
``

**No intentes falsificar estos valores.** Solo la herramienta de Farcaster (o tu wallet privada) puede generarlos correctamente.

## Preguntas

- **¿Cuál es mi FID?** — Aparece en tu perfil de Warpcast (número único de tu cuenta).
- **¿Dónde está mi custody wallet?** — Es la wallet con la que te registraste en Farcaster, almacenada en tu navegador/MiniPay o en una extensión de wallet.
- **¿Qué pasa si no firmo?** — El manifest funcionará parcialmente (se verá el icono y nombre), pero no será "verificado" en Farcaster, y algunos clientes pueden rechazarlo.
