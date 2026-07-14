// ============================================================
//  Frontle — Score card compartible (imagen tipo Wordle).
//  Se dibuja en un <canvas> (spoiler-free: cuadritos del semáforo +
//  estrellas + métricas, sin revelar los países). Sirve para todos los
//  modos. shareCanvas() usa navigator.share con la imagen; si no, descarga
//  el PNG y copia el texto.
// ============================================================

export type Square = "green" | "yellow" | "red" | "start" | "end";

export interface ScoreCardData {
  modeLabel: string;   // "Reto diario", "Regiones · Colombia", "Adivina la bandera"
  dateLabel: string;   // fecha localizada
  stars: number;       // 0..3
  squares?: Square[];  // patrón de la ruta (opcional)
  stats: string[];     // líneas de métrica sin emoji, p.ej. ["5 países", "01:23"]
}

const SQ_COLOR: Record<Square, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  start: "#22d3ee",
  end: "#e879f9",
};

const S = 1080; // lado del lienzo

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : R * 0.42;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Parte una frase en las líneas que quepan en `maxW`. Sin esto, fillText pinta
// fuera del lienzo y el propio canvas lo recorta: en inglés "Connected with 2
// countries — the optimal route" salía cortada por los dos lados, también en el
// PNG que comparte el jugador.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Dibuja la tarjeta en el canvas dado (lo redimensiona a 1080²).
export function drawScoreCard(canvas: HTMLCanvasElement, d: ScoreCardData) {
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fondo (gradiente del tema)
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#1c0b3e");
  g.addColorStop(1, "#120626");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";

  // Marca
  ctx.fillStyle = "#fcff52";
  ctx.font = "900 96px system-ui, sans-serif";
  ctx.fillText("FRONTLE", S / 2, 150);

  // Modo + fecha. "Regiones · Colombia" en francés se acerca al borde: el
  // maxWidth lo condensa en vez de dejar que el lienzo lo corte.
  ctx.fillStyle = "#c4b5fd";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(d.modeLabel, S / 2, 220, S - 140);
  ctx.fillStyle = "#8b7bb8";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText(d.dateLabel, S / 2, 268);

  // Estrellas
  const starR = 46;
  const gap = 130;
  const startX = S / 2 - gap;
  for (let i = 0; i < 3; i++) {
    star(ctx, startX + i * gap, 380, starR, i < d.stars ? "#fcff52" : "rgba(255,255,255,0.15)");
  }

  // Cuadritos del semáforo (patrón de la ruta), en rejilla centrada
  if (d.squares && d.squares.length) {
    const per = Math.min(d.squares.length, 8);
    const sz = 84, sgap = 20;
    const rowW = per * sz + (per - 1) * sgap;
    let x0 = (S - rowW) / 2;
    let y = 480;
    d.squares.forEach((sq, i) => {
      if (i > 0 && i % per === 0) { y += sz + sgap; x0 = (S - rowW) / 2; }
      const col = i % per;
      roundRect(ctx, x0 + col * (sz + sgap), y, sz, sz, 16);
      ctx.fillStyle = SQ_COLOR[sq];
      ctx.fill();
    });
  }

  // Métricas. Se parten en varias líneas si hacen falta y el bloque se centra
  // en vertical, para no chocar ni con los cuadritos ni con el pie.
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 52px system-ui, sans-serif";
  const maxW = S - 140;
  const lines = d.stats.flatMap((line) => wrap(ctx, line, maxW));
  const lineH = 66;
  const top = 880 - ((lines.length - 1) * lineH) / 2;
  // El maxWidth de fillText es la última red: condensa una palabra suelta que
  // sea más ancha que la tarjeta entera y que wrap() no puede partir.
  lines.forEach((line, i) => ctx.fillText(line, S / 2, top + i * lineH, maxW));

  // Pie
  ctx.fillStyle = "#8b7bb8";
  ctx.font = "500 36px system-ui, sans-serif";
  ctx.fillText("frontle.vercel.app", S / 2, S - 60);
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Comparte el PNG del canvas (Web Share con archivo); si no se puede, lo
// descarga y copia el texto. Devuelve "shared" | "downloaded".
export async function shareCanvas(canvas: HTMLCanvasElement, text: string): Promise<"shared" | "downloaded"> {
  const blob = await toBlob(canvas);
  if (blob) {
    const file = new File([blob], "frontle.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text } as ShareData);
        return "shared";
      } catch { /* cancelado → cae al fallback */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frontle.png";
    a.click();
    URL.revokeObjectURL(url);
  }
  try { await navigator.clipboard?.writeText(text); } catch {}
  return "downloaded";
}
