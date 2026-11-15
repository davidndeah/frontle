# Retención: banderas, racha y duelos

> Propuesta del 9-nov-2026, a partir de las ideas de David (daily login con premios, 1v1 y Flag rush).

## El problema, con datos

Jugadores nuevos entre el 5 y el 8 de noviembre, según el primer modo que jugaron (Supabase: `xp_rounds` + `scores`):

| Primer modo | Nuevos | Vuelven al día siguiente | Probaron el reto diario |
|---|---|---|---|
| Reto diario | 167 | 15 % | 100 % |
| **Banderas** | **165** | **3 %** | **7 %** |
| Práctica | 67 | 0 % | 4 % |

Por banderas entra casi tanta gente como por el reto diario, pero vuelve 5 veces menos y casi no llega al modo principal. Son solo 4 días de datos (las rondas de los modos libres se registran desde el 5-nov) y solo cuentan jugadores con wallet, pero la diferencia es grande.

## Propuesta, en orden

1. **La racha cuenta con cualquier modo.** Hoy solo cuenta el reto diario (`scores`), así que quien juega banderas todos los días nunca suma racha. Los premios por racha son el "daily login", pero se ganan **jugando**, no solo por abrir la app, y se pagan en **monedas o XP, nunca en dinero**, para no abrir otra vía de abuso. Es el cambio más chico y el que antes se nota.
2. **Flag rush del día.** 60 segundos para acertar todas las banderas posibles, con bonus por aciertos seguidos. Todos juegan la misma secuencia ese día y hay un ranking propio. Le da a quien viene por banderas una razón para volver mañana.
3. **Puente al reto diario.** Al terminar el Flag rush: "¿Sabes cómo llegar de 🇫🇷 a 🇵🇱 por tierra? Pruébalo en el reto de hoy". Hoy solo el 7 % de los de banderas llega al reto diario, que es el único modo con premio.
4. **Duelos (1v1)**, ya en curso en el PR #83. Más adelante, duelos de Flag rush ("hice 23 banderas, ¿me ganas?").

## Cómo medirlo

Repetir la tabla de arriba 2 semanas después de cada cambio. La meta es que **banderas pase del 3 % de vuelta al día siguiente a acercarse al 15 % del reto diario**, y que suba la cantidad de jugadores de banderas que prueban el reto diario.
