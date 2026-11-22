// Solo en desarrollo: guarda en public/icons/neo/ los iconos 3D que dibuja
// /lab/iconos/exportar (three.js necesita un navegador para renderizar, así
// que el render se hace allí y aquí solo se escribe el archivo). En
// producción responde 404 y no escribe nada.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { name, dataUrl } = (await req.json()) as { name?: string; dataUrl?: string };
  if (!name || !/^[a-z0-9-]+$/.test(name)) return new Response("bad name", { status: 400 });
  const m = /^data:image\/webp;base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return new Response("bad data", { status: 400 });
  const dir = path.join(process.cwd(), "public", "icons", "neo");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(m[1], "base64");
  await writeFile(path.join(dir, `${name}.webp`), buf);
  return Response.json({ ok: true, bytes: buf.length });
}
