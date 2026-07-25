// ============================================================
//  Frontle — Loader del globo
//
//  Un planeta con continentes que derivan, para las esperas del juego. Encaja
//  donde la espera ES geográfica (cargar el atlas, dibujar un mapa) y donde
//  hay sitio para un bloque; para un spinner de 16px al lado de un texto sigue
//  siendo mejor un borde girando.
//
//  · La animación vive en globals.css (`.globe-loader`), no en el componente:
//    el proyecto usa Tailwind v4 + CSS global, no CSS-in-JS. El original de
//    donde salió esto traía styled-components, que habría metido otra
//    dependencia en el JS inicial justo donde MiniPay mide el tope de 2 MB.
//  · Los continentes son los blobs del ícono de la app y van pintados con los
//    colores del prisma (los mismos de public/icon.svg). Son decoración: el
//    verde de aquí NO es el verde "vas por la ruta óptima" de lib/theme.ts,
//    que es información y no se toca.
//  · `label` es obligatorio y ya viene traducido: el loader se anuncia a
//    lectores de pantalla y una espera sin nombre no dice nada.
// ============================================================

// Piso de duración de una espera, en ms. Una consulta que vuelve en 80 ms
// hace parpadear el loader: el jugador ve un destello y no alcanza a leer qué
// pasó, que se siente peor que esperar. Un segundo es el mínimo para que la
// aparición se lea como intencional.
export const MIN_LOADER_MS = 1000;

// Alarga una promesa hasta `ms` si vuelve antes. No la ralentiza cuando ya
// tardaba más: corren en paralelo, así que el coste real es max(promesa, ms).
export async function withMinDelay<T>(p: Promise<T>, ms: number = MIN_LOADER_MS): Promise<T> {
  const [value] = await Promise.all([p, new Promise((r) => setTimeout(r, ms))]);
  return value;
}

// Los cuatro continentes. Colores tomados del ícono de la app para que el
// loader se lea como el mismo planeta que la marca.
const CONTINENTS: { d: string; fill: string }[] = [
  {
    fill: "#22d3ee",
    d: "M29.4,-17.4C33.1,1.8,27.6,16.1,11.5,31.6C-4.7,47,-31.5,63.6,-43,56C-54.5,48.4,-50.7,16.6,-41,-10.9C-31.3,-38.4,-15.6,-61.5,-1.4,-61C12.8,-60.5,25.7,-36.5,29.4,-17.4Z",
  },
  {
    fill: "#22c55e",
    d: "M31.7,-55.8C40.3,-50,45.9,-39.9,49.7,-29.8C53.5,-19.8,55.5,-9.9,53.1,-1.4C50.6,7.1,43.6,14.1,41.8,27.6C40.1,41.1,43.4,61.1,37.3,67C31.2,72.9,15.6,64.8,1.5,62.2C-12.5,59.5,-25,62.3,-31.8,56.7C-38.5,51.1,-39.4,37.2,-49.3,26.3C-59.1,15.5,-78,7.7,-77.6,0.2C-77.2,-7.2,-57.4,-14.5,-49.3,-28.4C-41.2,-42.4,-44.7,-63,-38.5,-70.1C-32.2,-77.2,-16.1,-70.8,-2.3,-66.9C11.6,-63,23.1,-61.5,31.7,-55.8Z",
  },
  {
    fill: "#e879f9",
    d: "M30.6,-49.2C42.5,-46.1,57.1,-43.7,67.6,-35.7C78.1,-27.6,84.6,-13.8,80.3,-2.4C76.1,8.9,61.2,17.8,52.5,29.1C43.8,40.3,41.4,53.9,33.7,64C26,74.1,13,80.6,2.2,76.9C-8.6,73.1,-17.3,59,-30.6,52.1C-43.9,45.3,-61.9,45.7,-74.1,38.2C-86.4,30.7,-92.9,15.4,-88.6,2.5C-84.4,-10.5,-69.4,-20.9,-60.7,-34.6C-52.1,-48.3,-49.8,-65.3,-40.7,-70C-31.6,-74.8,-15.8,-67.4,-3.2,-61.8C9.3,-56.1,18.6,-52.3,30.6,-49.2Z",
  },
  {
    fill: "#fbbf24",
    d: "M39.4,-66C48.6,-62.9,51.9,-47.4,52.9,-34.3C53.8,-21.3,52.4,-10.6,54.4,1.1C56.3,12.9,61.7,25.8,57.5,33.2C53.2,40.5,39.3,42.3,28.2,46C17,49.6,8.5,55.1,1.3,52.8C-5.9,50.5,-11.7,40.5,-23.6,37.2C-35.4,34,-53.3,37.5,-62,32.4C-70.7,27.4,-70.4,13.7,-72.4,-1.1C-74.3,-15.9,-78.6,-31.9,-73.3,-43C-68.1,-54.2,-53.3,-60.5,-39.5,-60.9C-25.7,-61.4,-12.9,-56,1.1,-58C15.1,-59.9,30.2,-69.2,39.4,-66Z",
  },
];

// `sm` cabe dentro de un sheet o una tarjeta; `md` es el de los mapas; `lg`
// solo para pantalla completa, donde el globo ES el contenido.
const SIZES = { sm: "3.25rem", md: "5.5rem", lg: "7.5rem" } as const;

export type GlobeLoaderSize = keyof typeof SIZES;

export default function GlobeLoader({
  label,
  size = "md",
  className = "",
}: {
  /** Qué se está esperando, ya traducido. Se muestra y se anuncia. */
  label: string;
  size?: GlobeLoaderSize;
  className?: string;
}) {
  return (
    // role="status" + aria-live: al aparecer, el lector de pantalla anuncia el
    // label sin robar el foco. El globo va aria-hidden — es decoración, y el
    // texto ya dice lo mismo.
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="globe-loader" style={{ ["--globe-size" as string]: SIZES[size] }} aria-hidden>
        {CONTINENTS.map((c) => (
          <svg key={c.fill} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <path transform="translate(100 100)" d={c.d} fill={c.fill} />
          </svg>
        ))}
      </div>
      <p className={`text-center text-neutral-300 ${size === "sm" ? "text-xs" : "text-sm"}`}>{label}</p>
    </div>
  );
}
