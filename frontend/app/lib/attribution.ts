// Etiquetas de atribución de Celo (ERC-8021): unos bytes al final del
// calldata que marcan la tx como hecha desde Frontle. El EVM ignora los bytes
// sobrantes, así que no cambian lo que hace la tx ni lo que cuesta.
// Guía: https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md
//
// Van dos códigos en la misma tx:
//   - el ASIGNADO por Celo (Proof of Ship / MiniPay): es el único que acreditan
//     sus programas; uno derivado por nosotros no les cuenta.
//   - el derivado del hostname: el que el panel de MiniPay acredita para apps
//     de su lista, sin registro.
// Nunca agregar códigos de plataforma (p. ej. "minipay"): esos los pone la
// propia wallet, no la app.
import { codeFromHostname, withAttribution } from "@celo/attribution-tags";

// Código que nos asignó Celo. Va en el repo a propósito: igual queda público
// on-chain en cada tx.
const ASSIGNED_CODE: string | null = "celo_vi6ni6ah";

// Solo en el navegador (usa window.location). Las funciones de pago ya corren
// solo en el cliente; el guard es por si alguien la llama durante el SSR.
function attributionCodes(): string[] {
  const codes: string[] = [];
  if (typeof window !== "undefined") {
    try {
      codes.push(codeFromHostname(window.location.hostname));
    } catch {
      // hostname vacío/raro: se sigue con el asignado
    }
  }
  if (ASSIGNED_CODE) codes.push(ASSIGNED_CODE);
  return codes;
}

// Extensión para `createWalletClient(...).extend(attribution())`: TODA tx que
// envíe ese cliente (sendTransaction y writeContract) lleva la etiqueta, sin
// tocar cada llamada. Un `dataSuffix` propio, como el FRTL de los pagos
// diarios, queda antes de la etiqueta, pegado a los args.
// Sin códigos (SSR) no cambia nada.
export function attribution() {
  const codes = attributionCodes();
  return codes.length > 0 ? withAttribution(codes) : () => ({});
}
