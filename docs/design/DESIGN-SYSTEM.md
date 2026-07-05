# Frontle — Design System & Arquitectura de Navegación (v1)

> La referencia metódica de estética y menús. Derivada de la app actual + benchmark del top 10 de Proof of Ship (`docs/benchmark/`).
> Mockup navegable: [`mockup-nav.html`](mockup-nav.html) (abrir en navegador, vista móvil).

---

## 1. Tokens de diseño

### 1.1 Color

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#000000` | Fondo base |
| `--bg-deep` | `#04050a` | Fondo de pantalla con glow |
| `--surface` | `rgba(0,0,0,0.45)` + blur 12px | Cards "glass" sobre el glow |
| `--surface-solid` | `#0a0e1d` | Inputs, sheets, superficies sólidas |
| `--border` | `rgba(255,255,255,0.15)` | Borde estándar de cards |
| `--border-strong` | `rgba(255,255,255,0.25)` | Inputs, elementos interactivos |
| `--text` | `#ffffff` | Texto principal |
| `--text-2` | `#c3cbdd` | Texto secundario |
| `--text-3` | `#8791a8` | Hints, footers, metadatos |
| **Semáforo / juego** | | |
| `--start` | `#22d3ee` (cyan) | País origen |
| `--end` | `#e879f9` (fucsia) | País destino |
| `--good` | `#22c55e` (verde) | Ruta óptima |
| `--lateral` | `#eab308` (amarillo) | Desvío pequeño |
| `--far` | `#ef4444` (rojo) | Desvío grande |
| **Acentos** | | |
| `--prize` | `#fbbf24` (ámbar) | Pot, premios, monetización |
| `--prism` | gradiente `100deg: cyan→green→amber→fuchsia` | Marca (título, momentos de celebración) |

Reglas:
- El color **solo donde es funcional**: semáforo, origen/destino, premio. Todo lo demás blanco/gris sobre negro.
- El gradiente prisma se reserva para **marca y celebración** (logo, "Perfect route!"), nunca para UI utilitaria.
- Texto sobre glow SIEMPRE dentro de un contenedor `--surface` (lección: el glow mata el contraste del texto suelto).

### 1.2 Fondo de marca
1. Base `--bg-deep`
2. Grilla: líneas blancas `rgba(255,255,255,0.13)`, celda 46px
3. **Prism glow**: gradiente lineal cyan→verde→blanco→ámbar→rojo, enmascarado radial al centro, blur ~52px, `saturate(1.3)`
4. Núcleo blanco radial sutil

### 1.3 Tipografía

| Rol | Estilo |
|---|---|
| Marca "FRONTLE" | 900, tracking amplio, gradiente prisma |
| Título de pantalla | 22–24px, 700, blanco |
| Card title / país | 14–15px, 600 |
| Cuerpo | 14–16px, 400, `--text-2` |
| Metadatos / labels | 10–11px, uppercase, tracking `0.2em`, `--text-3` |
| Números (timer, pot, ranking) | mono (Consolas/Geist Mono), tabular |

### 1.4 Forma y espaciado
- Radios: cards `16px` · chips/botones `12–14px` · pills/sheets `20–24px` (sheet solo esquinas superiores)
- Padding de card: `16px` · gap entre secciones: `16–20px` · margen lateral de pantalla: `16px`
- Target táctil mínimo: `44px` de alto
- Diseñar y validar a **360×640** (mínimo MiniPay)

### 1.5 Botones

| Tipo | Estilo | Uso |
|---|---|---|
| Primario | fondo blanco, texto negro, 700 | Jugar, OK, Reclamar, pagar |
| Secundario | borde `--border-strong`, texto blanco, hover `bg white/10` | Reintentar, compartir |
| De pago | primario + precio visible `· 0.05 USDT` | Pistas, reintento |
| Chip/acción menor | borde del color semántico + tinte 10% | pistas activas, filtros |

Feedback: `active:scale-95` en todo lo tocable; nunca cambiar solo el color.

---

## 2. Arquitectura de navegación (IA)

### 2.1 Estructura

```
App shell
├── Header persistente
│   ├── Logo mini (izq)
│   ├── Chip pot 🏆 $X.XX          → tap: detalle del premio del día
│   └── Chip saldo 💰               → tap: WALLET SHEET
├── Contenido del tab activo
└── Bottom-nav (4 tabs, 56px alto, safe-area)
    ├── 🌍 Jugar     (default)
    ├── 🏆 Ranking
    ├── 👤 Perfil
    └── ❓ Aprender
```

### 2.2 Tab Jugar — solo el juego
- Estado A (pre-juego): card del reto (banderas + nombres + óptima) → botón **▶ Jugar** → VS screen 1.5s → Estado B
- Estado B (jugando): cronómetro (pill) · mapa (pan/zoom) · leyenda · chips de ruta · input+OK · botón **💡 Pistas** → abre HINTS SHEET
- Estado C (resuelto): win card (estrellas ⭐ por precisión) → **Compartir** (abre SHARE SHEET con la score card) · **Reintentar · $0.10**
- Fuera de este tab NO hay ranking ni countdown: el juego respira.

### 2.3 Tab Ranking
- Segmented control: **Hoy · Semana · Histórico**
- Tabla: posición (🥇🥈🥉) · bandera IP · alias/ID · ruta · tiempo
- **Tu fila fija** al fondo (sticky) si no estás en el top visible
- Header del tab: pot del día + countdown al próximo reto (aquí vive el countdown, no en Jugar)

### 2.4 Tab Perfil
- Identidad: avatar (bandera) + **alias editable** (nunca 0x como principal)
- Stats: 🔥 racha · ⭐ estrellas totales · 🏆 victorias · mejor tiempo
- 🎁 Premios reclamables (claim on-chain)
- Historial de retos (fecha, ruta, tiempo, estrellas)
- Footer: /terms · /privacy · /stats · soporte (Telegram)

### 2.5 Tab Aprender
- Tutorial con **Bordy** (burbujas, como el video): 3 pasos + semáforo explicado
- Reglas rápidas (cómo se gana, cómo funciona el pot, qué es una pista)
- (Futuro) **Modo práctica** vive aquí: retos aleatorios sin premio

### 2.6 Sheets (bottom-sheets, nunca páginas)
| Sheet | Contenido |
|---|---|
| **Wallet** | saldo USDT (+COPm), dirección corta, depositar (deeplink MiniPay), retirar |
| **Pistas** | 3 opciones con precio, compradas marcadas ✓, CTA de pago |
| **Share** | preview de la score card (imagen) + botones WhatsApp/X/copiar |

### 2.7 Overlays
- **Coach primera vez** (Bordy + mano señalando): 3 pasos sobre el tab Jugar; reabrible desde ❓
- **VS screen**: banderas grandes enfrentadas, 1.5s, al iniciar el reto

---

## 3. Reglas de copy (MiniPay-compliant)
- "Network fee" (nunca "gas") · "Depositar/Retirar" (nunca on/off-ramp) · "dólares digitales / stablecoin" (nunca "cripto")
- Identidad = alias o bandera; `0x…` truncado solo como hint secundario
- Tono: cercano, 2ª persona, cero jerga. Bordy habla en los mensajes de juego.

---

## 4. Backlog de implementación sugerido
1. App shell: header + bottom-nav + rutas (`/`, `/ranking`, `/perfil`, `/aprender`) — mover código existente, no reescribirlo
2. Sheets de wallet y pistas (extraer de la página actual)
3. Tab Ranking con segmented control (los datos ya existen en Supabase)
4. Perfil v1 (alias + racha + historial local)
5. Aprender v1 (tutorial estático con Bordy)
6. VS screen + coach overlay

*v1 — 2026-07-04. Mantener este doc como fuente de verdad al implementar.*
