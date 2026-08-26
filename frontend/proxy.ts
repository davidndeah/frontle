import { NextResponse, type NextRequest } from "next/server";

// ============================================================
//  Frontle — quién ve la landing y quién ve el juego en `/`
//
//  El problema: `/` es a la vez la puerta del navegador y la que abre
//  MiniPay, y la ÚNICA forma de detectar MiniPay es
//  `window.ethereum.isMiniPay` — no hay cabecera ni User-Agent oficial
//  (comprobado en la referencia de MiniPay). Esa señal solo existe
//  después de hidratar, así que el servidor, que es quien decide qué
//  HTML mandar, no puede preguntársela.
//
//  Lo que sí es seguro: MiniPay es una billetera de Android/iOS. NO
//  existe en escritorio. Así que un User-Agent de escritorio demuestra
//  que ese visitante no puede ser MiniPay, y solo a ese se le sirve la
//  landing. Cualquier cosa móvil —MiniPay incluida, pero también el
//  Chrome de un móvil— recibe el juego exactamente igual que hasta
//  ahora. Es un reparto conservador a propósito: equivocarse hacia el
//  otro lado significaría enseñarle una landing a un usuario de
//  MiniPay, que es justo el toque de más que su equipo pidió quitar.
//
//  Se sirve con `rewrite` y no con `redirect` para que la URL siga
//  siendo la de siempre: quien comparte frontle.earth comparte la
//  landing sin que el enlace cambie de forma. El canónico de la página
//  sigue apuntando a /inicio, así que para un buscador no hay
//  contenido duplicado.
// ============================================================

// Escritorio = una plataforma de sobremesa Y ninguna señal de móvil.
// Las dos condiciones importan: un Android manda "Linux" y un iPad
// nuevo puede llegar a decir "Macintosh".
const DESKTOP_PLATFORM = /Windows NT|Macintosh|X11|CrOS/i;
const HANDHELD = /Mobi|Android|iPhone|iPad|iPod|Silk|Opera Mini/i;

function esEscritorio(ua: string): boolean {
  if (!ua) return false; // sin User-Agent, el juego: el caso seguro
  return DESKTOP_PLATFORM.test(ua) && !HANDHELD.test(ua);
}

// Marca "este navegador ya decidió jugar". La ponen los botones de Jugar
// de la landing, que apuntan a `/?play=1`. Sin ella, un jugador de
// escritorio que se guarde frontle.earth se comería la landing cada día.
const COOKIE_JUGAR = "frontle-jugar";

export function proxy(request: NextRequest) {
  // Viene de pulsar Jugar en la landing: pasa al juego y se acuerda.
  if (request.nextUrl.searchParams.has("play")) {
    const res = NextResponse.next();
    res.cookies.set(COOKIE_JUGAR, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  }

  if (esEscritorio(request.headers.get("user-agent") ?? "")) {
    return NextResponse.rewrite(new URL("/inicio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Solo la raíz, y solo si el navegador no ha elegido ya jugar: con la
  // cookie puesta el proxy ni se ejecuta y `/` se sirve como siempre.
  // La clave va escrita a mano y no como constante: Next analiza este
  // objeto de forma estatica en el build y una variable no la resuelve.
  matcher: [{ source: "/", missing: [{ type: "cookie", key: "frontle-jugar" }] }],
};
