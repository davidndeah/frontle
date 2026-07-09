// ============================================================
//  Frontle — Modo Regiones: tipos compartidos
//  Una "región" es un país jugable por subdivisiones (departamentos,
//  estados…) con su propio grafo de adyacencias terrestres.
// ============================================================

export interface RegionEntity {
  /** Nombre canónico para mostrar (idioma local de la región). */
  name: string;
  /** Slug estable: clave de banderas (/flags/<region>/<code>.png) y del mapa. */
  code: string;
  /** Formas alternativas aceptadas en el input (sin tildes ya lo cubre normalize). */
  aliases?: string[];
  /** Vecinos por frontera terrestre (nombres canónicos). */
  neighbors: string[];
}

export interface RegionDef {
  /** Id corto y estable (viaja al ranking): "co", "us"… */
  id: string;
  /** Nombre del modo para la UI. */
  title: string;
  /** Emoji de la bandera del país. */
  flag: string;
  /** Sustantivo de las subdivisiones ("departamentos", "states"). */
  entityNoun: string;
  /** Entidades jugables (solo las que tienen frontera terrestre). */
  entities: RegionEntity[];
}
