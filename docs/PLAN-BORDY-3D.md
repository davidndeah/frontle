# PLAN — Bordy en 3D animado, desde cero (EXP-2b)

> Reemplaza el enfoque de la Parte C de [[PLAN-PALETA-BORDY]] para Bordy. El **EXP-1 de paleta
> sigue en pie** (PR #61, sin decidir). El **EXP-2 anterior (SVG plano) se cerró** — PR #62,
> descartado por David: se veía plano/genérico, sin el volumen del `bordy-m2.webp` actual, y las
> expresiones no leían como "Bordy". Este documento lo reemplaza.

---

## ⚠️ Modelo a usar: **Fable 5**, no Sonnet ni Haiku

Sigue aplicando el razonamiento de `PLAN-PALETA-BORDY.md`: esto es juicio estético subjetivo
sobre un personaje de marca, no ejecución mecánica de una spec. Fable 5 (`claude-fable-5`) es el
modelo más capaz de Anthropic hoy, con visión de alta fidelidad para **comparar el resultado
contra las fotos de referencia** — es exactamente lo que hace falta aquí, más que la vez pasada:
la ronda anterior falló en gran parte por no verificar visualmente el resultado contra el
personaje real con el rigor suficiente.

Tareas mecánicas y repetitivas (generar N variantes de pose ya decidida, correr contraste en
bucle, armar el HTML de comparación una vez decidido el diseño) se delegan a subagentes
Haiku/Sonnet, igual que en la ronda anterior.

---

## Qué falló en el intento anterior (no repetir)

El `bordy-svg-explore.html` (PR #62, cerrado) construyó a Bordy como SVG plano: formas
geométricas simples, gradientes lineales básicos, sin sensación de material ni luz. Comparado en
el propio mockup contra `bordy-m2.webp` (un render 3D glossy con clearcoat, luces de relleno y
rim lights), se veía como una versión degradada del personaje, no como una evolución. La lección:
**verificar con visión contra la referencia real en cada paso**, no solo al final — si a mitad de
camino el resultado ya no se parece a Bordy o se ve plano, parar y corregir antes de completar
las 5 expresiones.

Nota técnica importante: en el repo ya existe una exploración 3D previa y válida —
`docs/design/bordy-3d.html`, `bordy-3d-combos.html`, `bordy-3d-mix.html` — hecha en **Three.js**
con `RoundedBoxGeometry` + `MeshPhysicalMaterial` (roughness/clearcoat) + rim lights de color, que
sí logra el look glossy correcto. **David pidió explícitamente empezar de cero a partir de sus
fotos de referencia, sin reutilizar la geometría/diseño de esos archivos** — pero el enfoque
técnico (Three.js, materiales físicos con clearcoat, iluminación de 3 puntos con rim lights de
color) es una base razonable a considerar si el resultado con las referencias lo justifica; la
decisión de qué técnica de shading usar la toma Fable mirando las fotos, no este documento.

---

## Fotos de referencia

David va a adjuntar fotos de referencia de Bordy (estilo/personaje que busca). **Guardarlas en
`docs/design/references/`** (carpeta ya creada, vacía) antes de empezar — si al arrancar la tarea
la carpeta sigue vacía, pedirle a David las fotos antes de modelar nada; no inventar un diseño sin
haberlas visto.

---

## Tarea

1. Leer las fotos de `docs/design/references/`. Leer también `bordy-m2.webp` (el Bordy actual, en
   `frontend/public/`) — **no para copiarlo**, sino para poder compararlo lado a lado al final y
   entender qué personalidad/proporciones hay que igualar o superar.
2. Diseñar Bordy en 3D **desde cero**, basado en las fotos de referencia (no en las exploraciones
   `bordy-3d-*.html` existentes — esas son solo antecedente técnico, no punto de partida de
   diseño). Usar `frontend-design` para la personalidad del personaje: qué lo hace "Bordy" y no
   una mascota-robot genérica (ver el criterio de "signature element" de la skill).
3. Construir con **Three.js** (mismo stack que las exploraciones previas — es lo que permitiría
   integrarlo más adelante en la app vía `react-three-fiber` si David decide avanzar). Verificar
   con capturas del render contra las fotos de referencia **durante el proceso**, no solo al
   final — usar visión para comparar antes de dar por bueno el modelo base.
4. Una vez el modelo base esté aprobado visualmente contra la referencia, animar los mismos 5
   estados de expresión definidos en la ronda anterior (siguen vigentes, cada uno atado a un uso
   real del código — revisar `page.tsx` para el contexto exacto de cada uno):
   - **idle** (el `bordy-float` de siempre)
   - **acierto** (semáforo verde — ruta óptima)
   - **fallo** (semáforo rojo — desvío grande)
   - **racha/hito** (el `milestone-toast` de GAM-2)
   - **pensando** (al comprar una pista)
5. Construir en `docs/design/bordy-3d-explore.html`: el modelo 3D con controles para conmutar
   entre las 5 expresiones (rotación libre de cámara si aporta, opcional), comparado lado a lado
   con el `bordy-m2.webp` actual — mismo patrón visual que ya se usó en `bordy-svg-explore.html`
   (que se puede mirar como referencia de estructura de comparación, aunque no de diseño del
   personaje).

## Consideraciones de rendimiento (porque el destino final es producción)

A diferencia de la ronda de paleta, David **ya está pensando en reemplazar el webp en la app**
(vía `react-three-fiber`), y MiniPay corre en teléfonos de gama media/baja. Esta pasada sigue
siendo solo exploración en `docs/design/` (no tocar código de la app todavía), pero diseñar
teniendo en cuenta que more adelante importa:
- Conteo de polígonos y draw calls razonables para móvil (nada de geometría innecesariamente
  densa "porque se ve bien en desktop").
- Tamaño de textura/bundle si se usan texturas (vs. materiales proceduales con color plano +
  emissive, que es más liviano).
- Que la animación funcione bien con un render loop de React (no asumir un `setTimeout` único
  como en las exploraciones previas — pensar en qué se necesitaría para un loop continuo).

No hace falta resolver la integración a React en este PR — solo dejar constancia en el propio
HTML de exploración de cualquier decisión que ya tenga implicación de performance, para que la
siguiente fase (integración real) no empiece a ciegas.

## Entregable

`docs/design/bordy-3d-explore.html`. **No reemplazar `bordy-m2.webp` en el código de
producción** — sigue siendo exploración para que David decida.

## Aceptación

- El modelo 3D se parece de verdad a las fotos de referencia (verificado con visión, no solo
  descrito en texto) — si no hay fotos disponibles al empezar, parar y pedirlas.
- 5 expresiones, cada una justificada por un caso de uso real del código (no inventado).
- Comparación lado a lado con `bordy-m2.webp` explícita en el propio HTML.
- Nota de rendimiento (polígonos/texturas/draw calls) incluida en el HTML o en la descripción del
  PR, pensando en la integración futura a la app.
- PR pequeño, solo el HTML de exploración — no toca código de la app.
- `npx tsc --noEmit` limpio (el PR no debería tocar nada que rompa el build).

## Orden y entrega

1. Confirmar que hay fotos en `docs/design/references/` antes de empezar a modelar.
2. Iterar el modelo base con verificación visual constante contra la referencia — no avanzar a
   las 5 expresiones hasta que el modelo base esté aprobado.
3. Un solo PR para todo EXP-2b (a diferencia de EXP-1/EXP-2 que fueron PRs separados — aquí no
   hay una segunda pieza independiente que valga la pena separar).
4. Al terminar, avisar a David con la ruta del archivo y el link del PR para que decida — la
   decisión final de si este Bordy reemplaza al raster es suya, no de Fable.

---

*v1 — Sonnet, para ejecución de Fable. Reemplaza el EXP-2 de [[PLAN-PALETA-BORDY]] (PR #62,
cerrado). Continúa junto al EXP-1 de paleta (PR #61, aún sin decidir).*
