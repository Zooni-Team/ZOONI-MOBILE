# PROMPT — Pantalla **S.O.S Veterinario** (Zooni)

> **Destino:** Claude Code / Cursor
> **Backend:** Supabase (PostgreSQL + PostGIS + Realtime + Edge Functions)
> **Alcance:** pantalla base completa + 8 variantes de estado
> **Versión:** 1.0

---

## 0. Cómo usar este prompt

Pegá este documento completo como instrucción. Está dividido en dos ramas independientes pero acopladas por los contratos de la sección 4.6:

- **Rama A — FRONTEND** (secciones 2 y 3): todo lo visual, de layout, de estado y de interacción.
- **Rama B — BACKEND** (sección 4): esquema, seguridad, funciones y contratos.

Reglas duras para quien implemente:

1. **No inventar colores.** Solo se pueden usar los tokens de la sección 3.1. Cualquier color fuera de esa lista es un bug.
2. **No inventar copys.** Los textos literales están entre comillas en cada componente. Si falta un copy, pedirlo, no improvisarlo.
3. **Mobile-first, ancho de referencia 390px.** Todo debe verse correcto entre 320px y 430px de ancho.
4. **Cero datos hardcodeados en la UI final.** Los ejemplos con nombres de clínicas son placeholders de maqueta; los datos reales vienen de la sección 4.
5. Cuando una decisión no esté especificada acá, ganan las *Instrucciones Generales de Diseño de Zooni*.

---

## 1. Contexto de la pantalla

**Qué es:** la pantalla de emergencia de Zooni. Es la funcionalidad de mayor urgencia de toda la app: el usuario llega acá porque su mascota está mal *ahora mismo*. Todo el diseño se subordina a un único objetivo: **que el usuario pueda llamar a alguien en menos de 3 segundos y con una sola mano.**

**Consecuencias de diseño que se derivan de eso:**

- Las acciones de llamado van **arriba de todo**, antes de cualquier buscador o listado. Nunca requieren scroll.
- Las áreas táctiles son más grandes que en el resto de la app (mínimo 56px de alto, nunca menos de 48px).
- El rojo `#E63946` está **reservado exclusivamente** para esta pantalla y para el botón de acceso en Home. No aparece en ninguna otra pantalla de Zooni.
- No hay animaciones de entrada que retrasen la interacción. La pantalla debe ser tocable apenas monta, incluso mientras el listado de veterinarias todavía carga.
- Nada bloquea el llamado: si falla el GPS, si falla la red, si falla el backend, **los dos botones de llamada siguen funcionando** porque son números fijos guardados en el cliente.

**Tono de voz:** directo, calmo, sin dramatismo ni signos de exclamación múltiples. El usuario ya está nervioso; la app no lo pone más nervioso. Tuteo, igual que el resto de Zooni.

---

## 2. Punto de entrada y navegación

### 2.1 Cómo se llega

La pantalla **se accede desde Home (`Titán`)**, mediante el cuarto botón de la lista de navegación principal, el botón rojo **"SOS Veterinario"**. Ese botón es siempre el último de la columna y el de mayor peso visual de la pantalla Home.

Especificación del botón de entrada en Home (por si hay que ajustarlo):

- Ancho: 100% del contenedor menos 24px de margen por lado.
- Alto: 56px. `border-radius: 30px` (pill).
- Fondo: `--sos-red-fill` `#D62031` (no `#E63946`: con texto blanco de 17px da 4.17:1 y no pasa AA). Texto: `#FFFFFF`, Nunito Bold, 17px, centrado.
- Copy exacto: `SOS Veterinario`. Ícono opcional a la izquierda del texto: cruz médica o sirena, 20px, blanco.
- Sombra: `0 4px 8px rgba(230,57,70,0.32)` — sombra teñida de rojo, un poco más marcada que la de los botones amarillos, para que se lea como el elemento más urgente.
- Sin animación de pulso ni parpadeo. La jerarquía se logra por color y posición, no por movimiento.

### 2.2 Transición

- Navegación **push** con transición horizontal estándar (slide desde la derecha), 250ms, curva `ease-out`.
- La pantalla SOS **conserva la bottom tab bar** de Zooni. El usuario tiene que poder salir de la emergencia sin perder el contexto de la app.
- Al entrar, se dispara inmediatamente y en paralelo: (a) pedido de permiso de ubicación si no está concedido, (b) fetch del listado de veterinarias. Ninguno de los dos bloquea el render.

### 2.3 Cómo se sale

- Gesto de swipe-back nativo (iOS) y botón físico atrás (Android) → vuelven a Home.
- El ícono de hamburguesa del header abre el drawer lateral global, **no** actúa como botón "atrás".
- Si hay una **emergencia activa** (variante V7), salir de la pantalla **no cancela** la emergencia: se muestra un banner persistente arriba de la bottom tab bar en el resto de la app, que permite volver a SOS con un toque.

---

# RAMA A — FRONTEND

## 3.1 Tokens de estilo (fuente de verdad)

### Color

| Token | Hex | Uso en esta pantalla |
|---|---|---|
| `--sos-red` | `#E63946` | **Identidad únicamente:** íconos, borde de la card V7, punto pulsante. NO como fondo de texto chico |
| `--sos-red-fill` | `#D62031` | Fondo de toda superficie roja que lleve texto blanco menor a 19px (cards, botón `Llamar`) |
| `--sos-red-dark` | `#C1121F` | Fin del degradado de la card C y estado `:pressed` |
| `--sos-red-text` | `#B3121D` | **Texto rojo sobre blanco o sobre tint** (botones C1/C2, badge `URGENCIAS`) |
| `--sos-red-tint` | `#FDECEE` | Fondo de chips y badges de urgencia sobre blanco |
| `--bg-main` | `#C8F0D8` | Fondo general de la pantalla |
| `--bg-scroll` | `#F4FBF6` | Fondo del área de listado (verde casi blanco, para separar del hero) |
| `--surface` | `#FFFFFF` | Cards, buscador, botones de llamada |
| `--brand` | `#2DBD72` | **Solo rellenos decorativos:** punto de estado junto a texto, fondo de ilustraciones |
| `--brand-dark` | `#27AE60` | Rellenos en estado pressed |
| `--brand-text` | `#177046` | **Obligatorio para texto e íconos verdes**, sobre blanco, sobre `--bg-scroll` y sobre menta. Único verde legible en las tres superficies |
| `--cta` | `#F5C842` | Botón amarillo secundario ("Ver todas en el mapa"), siempre con texto `--text` |
| `--cta-soft` | `#F7D060` | Estado pressed del CTA |
| `--amber` | `#F5A623` | **Solo el glifo de la estrella de rating y el badge de notificación** (decorativos, redundantes con el texto que acompañan) |
| `--amber-text` | `#A05F00` | Texto ámbar (`Cierra en 45 min`) |
| `--text` | `#2C2C2C` | Texto principal |
| `--text-soft` | `#6B6B6B` | Subtítulos, especialidad, distancia |
| `--text-inverse` | `#FFFFFF` | Texto sobre rojo |
| `--divider` | `#E8EFE9` | Separadores y borde del input |
| `--icon-off` | `#AAAAAA` | Íconos de tab inactivos |

### Tipografía

Familia única: **Nunito** (fallback `Poppins`, luego system sans).

| Rol | Peso | Tamaño | Interlineado |
|---|---|---|---|
| Título del header | ExtraBold (800) | 20px | 26px |
| Título de card de emergencia | ExtraBold (800) | 19px | 25px |
| Cuerpo dentro de card roja | SemiBold (600) | 14px | 20px |
| Texto de botón de llamada | Bold (700) | 16px | 22px |
| Título de sección | Bold (700) | 17px | 23px |
| Nombre de veterinaria | Bold (700) | 16px | 22px |
| Especialidad / dirección | Regular (400) | 14px | 20px |
| Metadatos (distancia, horario) | SemiBold (600) | 13px | 18px |
| Placeholder del buscador | Regular (400) | 15px | 20px |
| Label de tab | SemiBold (600) | 11px | 14px |

Ningún texto por debajo de 13px. Nunca texto en mayúsculas completas salvo la sigla "S.O.S".

### Espaciado, radios y sombras

- Escala de espaciado: `4 / 8 / 12 / 16 / 20 / 24 / 32`.
- Margen horizontal de pantalla: **20px** a cada lado.
- Separación vertical entre bloques: **16px**. Entre secciones distintas: **24px**.
- Radios: cards de emergencia `20px`; cards de veterinaria `16px`; buscador `28px` (pill); botones de llamada `30px` (pill); chips `12px`; avatares/logos `12px`.
- Sombra estándar de card: `0 4px 8px rgba(0,0,0,0.12)`.
- Sombra de card roja: `0 6px 16px rgba(230,57,70,0.28)`.
- Sombra de botón blanco sobre rojo: `0 2px 6px rgba(0,0,0,0.18)`.

---

## 3.2 Anatomía de la pantalla, de arriba hacia abajo

```
┌─────────────────────────────────────────┐
│ [safe area / status bar]                │
│ ☰            S.O.S Veterinario      🔔  │  ← A. Header
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ✚  Emergencia Veterinaria        │  │  ← B. Card informativa
│  │  Si tu mascota necesita atención  │  │
│  │  urgente, contactá ahora.         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ☎  Líneas de Emergencia          │  │  ← C. Card de acciones
│  │  Veterinarias de emergencia 24hs  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ☎ Llamar: 0800-123-4567     │  │  │  ← C1. Botón línea Zooni
│  │  └─────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 🚑 Emergencias: 911          │  │  │  ← C2. Botón emergencias
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤  ← inicia área scrolleable
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Buscar veterinario por nombre… │  │  ← D. Buscador
│  └───────────────────────────────────┘  │
│  ( Abierto 24hs ) ( Más cerca ) ( ⭐ )  │  ← E. Chips de filtro
│                                         │
│  Veterinarios Disponibles          (12) │  ← F. Header de sección
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🏥  Clínica Veterinaria del   ⭐4.8│  │  ← G. Card de veterinaria
│  │     Centro                        │  │
│  │     Medicina General · Emergencias│  │
│  │     📍 Av. Rivadavia 1234 · 1,2 km│  │
│  │     ● Abierto ahora               │  │
│  │  ┌──────────┐  ┌────────────────┐ │  │
│  │  │ ☎ Llamar │  │ 🧭 Cómo llegar │ │  │
│  │  └──────────┘  └────────────────┘ │  │
│  └───────────────────────────────────┘  │
│  … (n cards)                            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     Ver todas en el mapa          │  │  ← H. CTA amarillo
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  Amigos   Servicios  Solicitudes  Buscar│  ← I. Bottom tab bar
└─────────────────────────────────────────┘
```

**Regla de layout crítica:** el bloque **A + B + C es sticky / no scrolleable** en pantallas de 700px de alto o más. Solo hace scroll el contenido desde el buscador hacia abajo. En pantallas más bajas (menos de 700px), todo scrollea pero **el bloque C debe quedar visible sin scroll al montar**: si no entra, se reduce el padding vertical de la card B antes que mover C hacia abajo.

---

## 3.3 Especificación componente por componente

### A. Header

- Alto: 56px + safe area superior.
- Fondo: `#C8F0D8` (mismo que el fondo principal, sin borde ni sombra, para que se lea como una sola superficie continua con el hero).
- **Izquierda:** ícono hamburguesa `☰`, 24×24px, trazo 2px, color `--brand-text` (`#177046`). Área táctil real 44×44px. Acción: abre el drawer lateral global.
- **Centro:** título `S.O.S Veterinario`. Nunito ExtraBold 20px, color `--brand-text` (`#177046`; `--brand-dark` sobre menta da 2.31:1 y es ilegible). Centrado ópticamente respecto del ancho total de la pantalla, no del espacio libre entre íconos.
  - A la izquierda del texto, separado 8px: **ícono de cruz médica** de 18px en `--sos-red-text` dentro de un círculo `--sos-red-tint` de 26px. **No usar emoji de sirena.** Los emojis dentro de títulos rompen la consistencia tipográfica entre iOS y Android; se reemplazan por íconos vectoriales en toda la pantalla.
- **Derecha:** ícono de campana `🔔`, 24×24px, color `--brand-text`, con badge circular de 8px en `--amber` arriba a la derecha si hay notificaciones sin leer. Área táctil 44×44px.
- El título **no** se trunca: si no entra, se reduce a 18px antes de truncar.

### B. Card informativa "Emergencia Veterinaria"

Card de contexto. **No es tocable.** Explica qué es esta pantalla y baja la ansiedad del usuario.

- Ancho: 100% menos 20px de margen por lado. Padding interno: `20px 18px`.
- Fondo: degradado lineal vertical de `--sos-red-fill` `#D62031` (arriba) a `--sos-red-dark` `#C1121F` (abajo). Es sutil, casi plano — no debe leerse como un gradiente decorativo. **El rojo se oscurece hacia abajo a propósito:** el texto de cuerpo cae sobre la zona oscura, donde el blanco alcanza contraste AA (ver 3.6).
- `border-radius: 20px`. Sombra: `0 6px 16px rgba(230,57,70,0.28)`.
- **Ícono:** cruz médica blanca de 22px, centrada horizontalmente, 0px arriba del título. Opcional: círculo blanco al 15% de opacidad de 40px detrás del ícono.
- **Título:** `Emergencia Veterinaria` — Nunito ExtraBold 19px, `#FFFFFF`, centrado. Margen superior 10px respecto del ícono.
- **Cuerpo:** `Si tu mascota necesita atención urgente, contactá ahora mismo.` — Nunito SemiBold 14px, `#FFFFFF` **al 100% de opacidad** (nunca translúcido: baja el contraste por debajo del mínimo), centrado, máximo 2 líneas, interlineado 20px. Margen superior 8px.
  - ⚠️ **Corrección respecto del diseño actual:** en la pantalla existente este texto tiene una porción con un tratamiento visual distinto (se lee tachado/subrayado) que parece un error de estilo heredado. El texto debe ser **una sola tirada uniforme, sin `text-decoration` de ningún tipo**.
- Sin borde. Sin botón. Sin flecha.

### C. Card de acciones "Líneas de Emergencia"

El componente más importante de la pantalla.

- Mismas medidas de ancho y radio que B. Padding interno: `20px 18px 22px`.
- Fondo: degradado lineal vertical de `#C1121F` (arriba) a `#A00E18` (abajo). **Más oscuro y saturado que la card B**, para que se lea como el escalón siguiente de urgencia, y para que todo el texto blanco pase contraste AA con margen.
- Sombra: `0 6px 16px rgba(193,18,31,0.32)`.
- **Ícono:** teléfono blanco de 20px, centrado.
- **Título:** `Líneas de Emergencia` — ExtraBold 19px, blanco, centrado.
- **Subtítulo:** `Veterinarias de emergencia 24 hs` — SemiBold 14px, blanco al 100%, centrado. Margen inferior 16px.

#### C1. Botón "Llamar: 0800-123-4567"

- Ancho: 100% del contenido de la card. Alto: **56px**. `border-radius: 30px`.
- Fondo `#FFFFFF`. Sombra `0 2px 6px rgba(0,0,0,0.18)`.
- Contenido centrado como fila: ícono de teléfono 18px en `--sos-red-text` + 10px de gap + texto `Llamar: 0800-123-4567` en Nunito Bold 16px, color `--sos-red-text` (`#B3121D`; el `#E63946` original sobre blanco da 4.17:1 y no pasa AA).
- `:pressed` → fondo `#F7F7F7`, `transform: scale(0.97)`, 120ms.
- **Acción:** abre el marcador nativo con el número precargado (`tel:` intent). **No inicia la llamada automáticamente** — el usuario debe confirmar en el marcador del sistema. Esto es deliberado: evita llamadas accidentales.
- Antes de abrir el marcador, dispara el registro de evento del backend (sección 4.6, `log_sos_call`) de forma **no bloqueante**: si el log falla, la llamada se abre igual.

#### C2. Botón "Emergencias: 911"

- Idéntico a C1 en medidas y comportamiento. Margen superior: 12px.
- Ícono: ambulancia o cruz, 18px, `--sos-red-text`. Texto: `Emergencias: 911`.
- El número debe ser **configurable por país** desde el backend (ver `emergency_lines` en 4.2), con fallback local a `911` si el fetch falla. Argentina usa 911 para emergencias generales; el valor no se hardcodea en el componente.

> **Nota de accesibilidad crítica:** ambos botones deben tener `accessibilityRole="button"` y label explícito (`"Llamar a la línea de emergencia de Zooni, cero ochocientos ciento veintitrés, cuarenta y cinco, sesenta y siete"`), porque un lector de pantalla leyendo dígitos sueltos en una emergencia es inútil.

### D. Buscador

- Primer elemento del área scrolleable. Margen superior 20px respecto de la card C.
- Ancho: 100% menos 20px por lado. Alto: 48px. `border-radius: 28px`.
- Fondo `#FFFFFF`, borde `1px solid var(--divider)`. Sin sombra (o sombra muy leve `0 1px 3px rgba(0,0,0,0.06)`).
- Ícono de lupa 18px `--text-soft` a 16px del borde izquierdo. Texto a 10px del ícono.
- **Placeholder exacto:** `Buscar veterinario por nombre, especialidad o zona`.
  - En 390px este placeholder **se trunca** (es lo que se ve en el diseño actual). Solución: usar un placeholder corto `Buscar veterinaria o especialidad` y mostrar el texto completo como hint debajo del input al enfocarlo. Nunca dejar un placeholder cortado a mitad de palabra.
- **Comportamiento:**
  - Filtrado con **debounce de 300ms**.
  - Búsqueda contra: nombre, especialidades, barrio/zona y servicios.
  - Insensible a mayúsculas y **a tildes** (`veterinaria` encuentra `Veterinaría`).
  - Mínimo 2 caracteres para disparar la búsqueda remota; con menos, filtra localmente sobre lo ya cargado.
  - Al escribir aparece una **X** de limpiar a la derecha (18px, `--text-soft`, área táctil 44px).
  - Al enfocar, la pantalla **no** hace scroll automático que oculte los botones de llamada.
  - El teclado se cierra con el gesto de scroll sobre el listado.

### E. Chips de filtro

Fila horizontal scrolleable, margen superior 12px respecto del buscador. Este bloque **no existe en el diseño actual** y se agrega porque en una emergencia "abierto ahora" y "más cerca" son las dos preguntas reales del usuario.

- Chip: alto 34px, padding horizontal 14px, `border-radius: 12px`, Nunito SemiBold 13px.
- **Inactivo:** fondo `#FFFFFF`, borde `1px solid var(--divider)`, texto `--text-soft`.
- **Activo:** fondo `--brand-text` (`#177046`), texto `#FFFFFF`, sin borde. (`#2DBD72` con texto blanco da 2.43:1 y es ilegible.)
- Gap entre chips: 8px. El primer chip alinea con el margen de 20px; la fila hace overflow scroll horizontal sin barra visible.
- Chips en orden: `Abierto ahora` · `Atiende 24 hs` · `Más cerca` · `Mejor puntuadas` · `Urgencias` · `Atiende a domicilio`.
- `Abierto ahora` viene **activo por defecto**.
- Los filtros son acumulables salvo `Más cerca` / `Mejor puntuadas`, que son mutuamente excluyentes (definen el orden).

### F. Header de sección

- Texto izquierdo: `Veterinarios Disponibles` — Nunito Bold 17px, `--text`. Margen superior 20px.
- A la derecha, contador: `12 cerca tuyo` en SemiBold 13px `--text-soft`. Si no hay ubicación, dice `12 en tu ciudad`.
- Sin línea divisoria debajo.

### G. Card de veterinaria (item del listado)

Toda la card es tocable y navega al **Detalle de Veterinaria**.

- Ancho: 100% menos 20px por lado. Padding: `16px`. `border-radius: 16px`. Fondo `#FFFFFF`. Sombra `0 4px 8px rgba(0,0,0,0.12)`. Separación entre cards: 12px.

Contenido, en filas:

1. **Fila superior**
   - Izquierda: **logo/avatar** de 44×44px, `border-radius: 12px`. Si no hay imagen, cuadrado `--sos-red-tint` con la inicial del nombre en `--sos-red-text` ExtraBold 18px.
   - Al lado (12px de gap): **nombre**, Nunito Bold 16px `--text`, máximo **2 líneas**, `ellipsis` en la segunda. (En el diseño actual "Clínica Veterinaria del Centro" ocupa 2 líneas — está bien, es el comportamiento esperado.)
   - Derecha, alineado arriba: **rating** = estrella llena 14px `--amber` (glifo decorativo) + 4px + `4.8` en SemiBold 14px `--text` (el número **no** va en ámbar: `#F5A623` sobre blanco da 2.03:1). Debajo, `(87)` en Regular 11px `--text-soft` con la cantidad de reseñas. Si no hay reseñas, se muestra `Nuevo` en un chip de fondo `#E8F7EE` con texto `--brand-text` en lugar del rating.
2. **Especialidad** — `Medicina General · Emergencias 24 hs`, Regular 14px `--text-soft`, 1 línea con ellipsis. Margen superior 8px.
   - Cambio respecto del diseño actual: se elimina el prefijo literal `Especialidad:`. Ocupa ancho sin aportar información; el contexto ya lo da.
3. **Dirección y distancia** — ícono de pin 13px `--brand-text` + `Av. Rivadavia 1234, Caballito` + separador `·` + `1,2 km`. SemiBold 13px `--text-soft`. Si no hay permiso de ubicación, se omite la distancia y **no** se deja el separador colgando.
4. **Estado horario** — punto de 8px + texto SemiBold 13px:
   - Abierto: punto `--brand`, texto `Abierto ahora` en `--brand-text`.
   - Cierra pronto (menos de 60 min): punto `--amber`, texto `Cierra en 45 min` en `--amber-text`.
   - Cerrado: punto `#AAAAAA`, texto `Cerrado · Abre 8:00` en `--text-soft`.
   - 24 hs: punto `--brand`, texto `Abierto 24 hs` en `--brand-text`.
5. **Fila de acciones** — margen superior 14px, separada por una línea `1px --divider` con 12px de aire arriba.
   - Botón primario `Llamar`: alto 44px, flex 1, `border-radius: 22px`, fondo `--sos-red-fill`, texto blanco Bold 15px, ícono de teléfono 16px blanco. Abre el marcador con el teléfono de esa veterinaria.
   - Botón secundario `Cómo llegar`: alto 44px, flex 1, `border-radius: 22px`, fondo `#FFFFFF`, borde `1.5px solid var(--brand-text)`, texto `--brand-text` Bold 15px, ícono de brújula. Abre la app de mapas nativa con las coordenadas de destino.
   - Gap entre botones: 10px.
6. **Badge opcional de urgencia** — si la veterinaria tiene `emergency_service = true`, chip en la esquina superior derecha de la card: fondo `--sos-red-tint`, texto `--sos-red-text` Bold 11px, copy `URGENCIAS`, `border-radius: 8px`, padding `4px 8px`.

**Orden por defecto del listado:** primero las que están abiertas y atienden urgencias, después por distancia ascendente, y a igualdad de distancia por rating descendente.

**Paginación:** carga inicial de 10 items, scroll infinito con lotes de 10. Al llegar al final se muestra un texto centrado `No hay más veterinarias cerca` en Regular 13px `--text-soft`.

### H. CTA "Ver todas en el mapa"

- Aparece al final del listado, con 20px de margen superior y 24px inferior.
- Ancho: 100% menos 20px por lado. Alto: 54px. `border-radius: 30px`.
- Fondo `--cta` (`#F5C842`). Texto `Ver todas en el mapa` en Nunito Bold 16px `--text` (gris oscuro, **no** blanco — el contraste de blanco sobre amarillo es insuficiente). Ícono de mapa 18px `--text` a la izquierda.
- Sombra `0 4px 8px rgba(0,0,0,0.12)`. `:pressed` → fondo `--cta-soft`, `scale(0.98)`.
- Acción: navega al mapa filtrado por veterinarias de urgencia, reutilizando el componente de **Mapa de Amigos** con otra capa de marcadores.

### I. Bottom tab bar

Componente global de Zooni, sin cambios. Fondo `#FFFFFF`, borde superior `1px --divider`, alto 64px + safe area. Tabs: **Amigos · Servicios · Solicitudes · Buscar**. En esta pantalla el tab activo es **Servicios** (SOS cuelga de Servicios, no es un tab propio). Ícono activo `--brand-text` con label Bold; inactivos `--icon-off` con label SemiBold.

---

## 3.4 Variantes de estado

Implementar las 8. Cada una reemplaza **solo el área scrolleable** (D a H) salvo que se indique lo contrario: **el header y las cards rojas B y C siempre se renderizan, en todos los estados, sin excepción.**

| # | Variante | Cuándo | Qué se muestra |
|---|---|---|---|
| **V1** | **Base** | Todo OK, hay resultados | Lo descrito en 3.2 |
| **V2** | **Cargando** | Fetch inicial en curso | Buscador y chips visibles pero deshabilitados (opacidad 0.5). 3 cards skeleton: rectángulos `#EDF3EE` con shimmer de izquierda a derecha, 1.2s por ciclo, mismo alto que una card real (≈150px). **Sin spinner central.** |
| **V3** | **Sin permiso de ubicación** | El usuario denegó el GPS | Card blanca informativa arriba del listado: ícono de pin `--brand-text` 24px, título `Activá tu ubicación` Bold 15px, texto `Así te mostramos las veterinarias más cercanas primero.` Regular 13px `--text-soft`, y botón pill amarillo de 44px `Activar ubicación`. Debajo, el listado igual pero ordenado por rating y sin distancias. |
| **V4** | **Sin conexión** | No hay red | Banner `#FDECEE` con borde `1px #F5C6CB`, ícono de wifi tachado `--sos-red-text`, texto `Sin conexión. Los botones de llamada siguen funcionando.` Bold 13px `--sos-red-text`. El listado muestra los **últimos resultados cacheados** con una etiqueta `Datos guardados` en cada card; si no hay caché, se muestra V6 con copy de offline. Buscador y chips deshabilitados. |
| **V5** | **Búsqueda sin resultados** | Query devuelve 0 | Ilustración flat de un perro con lupa (estilo Zooni, ~120px), título `No encontramos veterinarias con ese nombre` Bold 15px centrado, texto `Probá con otra especialidad o zona.` Regular 13px `--text-soft`, y botón texto `Limpiar búsqueda` en `--brand-text` Bold 14px. |
| **V6** | **Sin veterinarias cerca** | Hay ubicación pero 0 resultados en el radio | Mismo layout que V5 con copy `No hay veterinarias registradas cerca tuyo`, subtexto `Podés llamar a la línea de emergencia de arriba, está disponible las 24 hs.` y botón amarillo `Ampliar la búsqueda a 20 km`. |
| **V7** | **Emergencia activa** | El usuario inició un SOS (ver 4.2, tabla `sos_events`) | Se **agrega** una card arriba de la card B: fondo `#FFFFFF`, borde `2px solid var(--sos-red)`, punto rojo pulsante de 10px (única animación permitida en la pantalla, 1.4s, opacidad 1→0.3), título `Emergencia en curso` Bold 16px `--sos-red-text`, línea de estado (`Buscando veterinaria` / `Clínica Veterinaria del Centro confirmó` / `En camino`), cronómetro `mm:ss` desde el inicio, y dos botones: `Ver detalle` (pill `--sos-red-fill` con texto blanco) y `Cancelar emergencia` (texto `--text-soft`, que abre un diálogo de confirmación). Esta card **persiste como banner** en el resto de la app. |
| **V8** | **Error del servidor** | 5xx o timeout | Banner igual a V4 con copy `No pudimos cargar las veterinarias.` y botón texto `Reintentar` en `--brand-text` Bold 14px. Reintento automático con backoff exponencial: 2s, 4s, 8s, y después solo manual. |

**Diálogo de confirmación de llamada (opcional, activable por flag):** bottom sheet de 220px, `border-radius: 24px 24px 0 0`, con `¿Llamar a 0800-123-4567?`, el nombre de la línea, botón rojo `Llamar` y botón texto `Cancelar`. Recomendación: **desactivado por defecto** en las líneas de emergencia (un tap extra en una urgencia es un costo real) y **activado** en el botón `Llamar` de las cards individuales, donde el riesgo de toque accidental durante el scroll es alto.

---

## 3.5 Interacciones y microinteracciones

- **Feedback háptico:** impacto medio al tocar C1 o C2; impacto ligero al tocar chips y cards.
- **Estados de presión:** toda superficie tocable baja a `scale(0.97)` en 120ms `ease-out` y vuelve en 160ms. Ninguna excepción.
- **Pull to refresh** sobre el listado: indicador circular en `--brand-text`, refresca ubicación y resultados.
- **Sin animaciones de entrada escalonadas.** Las cards aparecen todas juntas con un fade de 150ms. Nada de stagger: retrasa el primer toque.
- **Rotación:** la pantalla se bloquea en vertical.
- **Modo oscuro:** fuera de alcance en v1. Si se implementa después, el rojo pasa a `#FF5A65` sobre fondo `#12211A` para mantener contraste.
- **Doble toque:** los botones de llamada tienen guard de 1500ms para evitar disparar dos intents de marcado seguidos.

## 3.6 Accesibilidad (no negociable en esta pantalla)

- Contraste mínimo **4.5:1** en todo texto (3:1 en texto ≥18.66px Bold y en bordes/íconos que transmiten información).

  Ratios WCAG calculados sobre la paleta final. Los ❌ son los que **no** se pueden usar y explican por qué existen los tokens `-text`:

  | Combinación | Ratio | Veredicto |
  |---|---|---|
  | Blanco sobre `--sos-red` `#E63946` | 4.17 | ❌ para texto chico — por eso los fondos usan `--sos-red-fill` |
  | Blanco sobre `--sos-red-fill` `#D62031` | 5.11 | ✅ |
  | Blanco sobre `--sos-red-dark` `#C1121F` | 6.22 | ✅ |
  | `--sos-red` `#E63946` sobre blanco | 4.17 | ❌ — el texto rojo usa `--sos-red-text` |
  | `--sos-red-text` `#B3121D` sobre blanco | 6.95 | ✅ |
  | `--sos-red-text` sobre `--sos-red-tint` | 6.09 | ✅ |
  | `--brand` `#2DBD72` sobre blanco | 2.43 | ❌ — nunca como texto ni como borde informativo |
  | `--brand-dark` `#27AE60` sobre menta `#C8F0D8` | 2.31 | ❌ — el título del header **no** puede ir en este verde |
  | `--brand-text` `#177046` sobre menta | 4.91 | ✅ |
  | `--brand-text` `#177046` sobre blanco | 6.10 | ✅ |
  | `--brand-text` sobre `--bg-scroll` `#F4FBF6` | 5.80 | ✅ |
  | `--text-soft` `#6B6B6B` sobre blanco | 5.33 | ✅ |
  | `--text` `#2C2C2C` sobre menta | 11.25 | ✅ |
  | `--text` `#2C2C2C` sobre `--cta` `#F5C842` | 8.79 | ✅ |
  | Blanco sobre `--cta` `#F5C842` | 1.59 | ❌ — por eso el CTA amarillo lleva texto gris oscuro |
  | `--amber` `#F5A623` sobre blanco | 2.03 | ❌ como texto — solo el glifo de la estrella, que es redundante con el número |
  | `--amber-text` `#A05F00` sobre blanco | 5.08 | ✅ |

- **Nunca bajar la opacidad del texto blanco sobre rojo.** El `92%` / `88%` de opacidad que se usa en las cards B y C es decorativo y rompe el ratio: el texto blanco va siempre a opacidad 1 y la jerarquía se logra con peso tipográfico, no con transparencia.
- Área táctil mínima real de **48×48px**, aunque el elemento visual sea menor.
- Soporte de tamaño de fuente del sistema hasta **200%**: las cards crecen en alto, el texto nunca se recorta, los botones pasan a apilarse en columna cuando el ancho no alcanza.
- Orden de foco del lector de pantalla: título → botón 0800 → botón 911 → buscador → filtros → cada card.
- Todo ícono informativo tiene label; los decorativos van marcados como ocultos para el lector.
- El estado del filtro activo se anuncia (`Filtro Abierto ahora, activado`).

---

# RAMA B — BACKEND (Supabase / PostgreSQL)

## 4.1 Extensiones requeridas

```sql
create extension if not exists postgis;      -- geolocalización y distancias
create extension if not exists unaccent;     -- búsqueda insensible a tildes
create extension if not exists pg_trgm;      -- búsqueda difusa por nombre
```

## 4.2 Esquema de datos

### `emergency_lines` — líneas de emergencia configurables

Existe para que los números de C1 y C2 no estén hardcodeados y puedan variar por país.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `country_code` | `text` NOT NULL | ISO-3166 alpha-2, ej. `AR` |
| `label` | `text` NOT NULL | Ej. `Línea Zooni 24 hs` |
| `phone` | `text` NOT NULL | En formato marcable |
| `kind` | `text` NOT NULL | `zooni` \| `national_emergency` |
| `priority` | `int` NOT NULL | Orden de aparición, menor primero |
| `is_active` | `bool` | `default true` |

Lectura pública. Escritura solo `service_role`.

### `veterinary_clinics` — veterinarias

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` NOT NULL | |
| `phone` | `text` NOT NULL | |
| `whatsapp` | `text` NULL | |
| `address` | `text` NOT NULL | |
| `neighborhood` | `text` NULL | Zona, se usa en la búsqueda |
| `city` / `province` | `text` | |
| `location` | `geography(Point,4326)` NOT NULL | Índice GIST |
| `logo_url` | `text` NULL | Supabase Storage |
| `specialties` | `text[]` NOT NULL | `default '{}'` |
| `services` | `text[]` | `internacion`, `cirugia`, `radiologia`, `domicilio` |
| `is_24h` | `bool` | `default false` |
| `emergency_service` | `bool` | `default false` — controla el badge `URGENCIAS` |
| `opening_hours` | `jsonb` | `{"mon":[["08:00","20:00"]], …}`, soporta cortes de mediodía |
| `rating_avg` | `numeric(2,1)` | Denormalizado, 0.0–5.0 |
| `rating_count` | `int` | `default 0` |
| `is_verified` | `bool` | `default false` |
| `is_active` | `bool` | `default true` |
| `created_at` / `updated_at` | `timestamptz` | |

```sql
create index idx_clinics_location on veterinary_clinics using gist (location);
create index idx_clinics_name_trgm on veterinary_clinics using gin (name gin_trgm_ops);
create index idx_clinics_specialties on veterinary_clinics using gin (specialties);
```

### `sos_events` — emergencias iniciadas por el usuario

Alimenta la variante **V7** y da métricas reales de uso.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `auth.users` | |
| `pet_id` | `uuid` FK → `pets` NULL | Qué mascota está en emergencia |
| `clinic_id` | `uuid` FK → `veterinary_clinics` NULL | Se completa si confirma una clínica |
| `status` | `text` NOT NULL | `searching` \| `confirmed` \| `on_the_way` \| `resolved` \| `cancelled` |
| `origin` | `text` | `hotline` \| `emergency_number` \| `clinic_call` \| `manual` |
| `location` | `geography(Point,4326)` NULL | Dónde estaba el usuario |
| `notes` | `text` NULL | Qué le pasa a la mascota |
| `started_at` / `resolved_at` | `timestamptz` | |

### `sos_call_logs` — auditoría de llamados

`id`, `user_id`, `clinic_id` (nullable), `line_id` (nullable), `phone_dialed`, `created_at`. Solo registro, nunca bloquea la UI.

### `emergency_contacts` — contactos del usuario

`id`, `user_id`, `name`, `phone`, `relation`, `notify_on_sos` (bool). Sirve para el avisado automático de la sección 4.6.

## 4.3 Row Level Security

Activar RLS en **todas** las tablas.

- `veterinary_clinics`: `select` abierto a `authenticated` y `anon` con filtro `is_active = true`. Insert/update solo `service_role`.
- `emergency_lines`: `select` abierto. Escritura solo `service_role`.
- `sos_events`: el usuario ve, crea y actualiza **solo sus propias filas** (`auth.uid() = user_id`). Nunca borrado físico: cancelar es `status = 'cancelled'`.
- `sos_call_logs`: insert propio, select propio. Sin update ni delete.
- `emergency_contacts`: CRUD completo restringido a `auth.uid() = user_id`.

## 4.4 Funciones RPC

### `nearby_clinics` — la consulta central del listado

```sql
create or replace function nearby_clinics(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   int     default 10000,
  p_query      text    default null,
  p_only_open  boolean default true,
  p_only_24h   boolean default false,
  p_emergency  boolean default false,
  p_order_by   text    default 'distance',  -- 'distance' | 'rating'
  p_limit      int     default 10,
  p_offset     int     default 0
)
returns table (
  id uuid, name text, phone text, address text, neighborhood text,
  logo_url text, specialties text[], is_24h boolean,
  emergency_service boolean, rating_avg numeric, rating_count int,
  distance_m double precision, is_open_now boolean,
  closes_at time, opens_at time, lat double precision, lng double precision
)
language sql stable as $$
  -- ST_DWithin sobre el índice GIST para el radio
  -- ST_Distance para la distancia exacta devuelta
  -- unaccent + ILIKE/similarity para p_query sobre name, neighborhood y specialties
  -- is_open_now resuelto contra opening_hours en la zona horaria de la clínica
  -- orden: emergency_service desc, is_open_now desc, luego distance_m asc o rating_avg desc
$$;
```

Notas de implementación:

- `p_lat` / `p_lng` pueden venir `null` (usuario sin GPS). En ese caso se ignora el radio, se ordena por `rating_avg desc` y `distance_m` vuelve `null`.
- `is_open_now` se calcula en SQL, **no en el cliente**: el teléfono puede tener la hora mal y en una emergencia eso manda al usuario a una puerta cerrada.
- Devolver siempre `lat`/`lng` sueltos para que el front arme el deep link a la app de mapas.

### `create_sos_event(p_pet_id, p_lat, p_lng, p_origin, p_notes)`

Crea el evento en `searching`, dispara la notificación a `emergency_contacts` con `notify_on_sos = true`, y devuelve el `sos_event` completo.

### `log_sos_call(p_phone, p_clinic_id, p_line_id)`

Inserta en `sos_call_logs`. Idempotente por ventana de 5 segundos para no duplicar por doble toque. **Fire-and-forget:** el front no espera la respuesta.

### `update_sos_status(p_event_id, p_status)`

Valida transiciones legales: `searching → confirmed → on_the_way → resolved`, y `cancelled` alcanzable desde cualquier estado no terminal. Rechaza saltos hacia atrás.

## 4.5 Realtime

Suscripción del cliente al canal de `sos_events` filtrado por `user_id = auth.uid()`. Cada cambio de `status` actualiza la card de V7 sin polling. Si el socket se cae, el front hace fallback a polling cada 20 segundos.

## 4.6 Contratos que consume el frontend

| Momento | Llamada | Bloquea UI |
|---|---|---|
| Al montar | `emergency_lines` filtrado por país del usuario | **No** — hay fallback local con `0800-123-4567` y `911` |
| Al montar / al cambiar filtros / al buscar | `nearby_clinics(...)` | No, muestra V2 |
| Scroll infinito | `nearby_clinics(... p_offset)` | No |
| Tap en C1, C2 o "Llamar" de una card | `log_sos_call(...)` | **Nunca.** El marcador se abre igual si falla |
| Inicio de emergencia | `create_sos_event(...)` | Muestra loader en el botón, timeout 8s |
| Emergencia en curso | Realtime sobre `sos_events` | No |

**Caché offline:** los últimos resultados de `nearby_clinics` y las `emergency_lines` se persisten localmente (AsyncStorage / MMKV) con TTL de 24 hs, para alimentar la variante V4.

## 4.7 Errores y contingencias

| Caso | Comportamiento esperado |
|---|---|
| GPS denegado | V3. Se consulta sin coordenadas, ordenado por rating dentro de la ciudad del perfil |
| GPS habilitado pero sin fix en 8s | Se sigue sin coordenadas y se muestra un toast `No pudimos ubicarte, mostramos las mejor puntuadas` |
| `nearby_clinics` timeout (>10s) | V8, con reintento 2s / 4s / 8s |
| 0 resultados con query | V5 |
| 0 resultados sin query | V6 |
| Sin red | V4, datos de caché |
| Falla `log_sos_call` | Silencio absoluto. Se encola y se reintenta al recuperar red |
| Falla `create_sos_event` | Alert con `No pudimos registrar la emergencia, pero podés llamar igual` + botón directo a C1 |
| Teléfono inválido o vacío en una clínica | Se oculta el botón `Llamar` de esa card y se deja solo `Cómo llegar` |

---

## 5. Criterios de aceptación

Marcar cada uno como verificado antes de dar la pantalla por terminada:

1. Desde Home, tocar el botón rojo SOS abre esta pantalla en menos de 300ms.
2. En un iPhone SE (375×667) los dos botones de llamada son visibles **sin hacer scroll**.
3. Tocar `Llamar: 0800-123-4567` abre el marcador nativo con el número precargado.
4. Con el modo avión activado, ambos botones de llamada siguen funcionando y aparece el banner V4.
5. Denegar el permiso de ubicación no rompe la pantalla: aparece V3 y el listado carga igual.
6. Buscar `centro` (sin tilde) encuentra `Clínica Veterinaria del Céntro`.
7. El chip `Abierto ahora` viene activo y filtra correctamente contra el horario del servidor, no del dispositivo.
8. Ninguna card muestra `Especialidad:` como prefijo literal.
9. No aparece ningún color fuera de la tabla de tokens de 3.1 (verificar con un color picker sobre la build).
9b. Ningún texto usa `--brand` `#2DBD72`, `--brand-dark` `#27AE60`, `--amber` `#F5A623` ni `--sos-red` `#E63946` como color de tipografía: los cuatro fallan AA sobre sus fondos (2.43 / 2.31 / 2.03 / 4.17). Para texto van siempre `--brand-text`, `--amber-text` y `--sos-red-text`.
9c. Ningún texto blanco dentro de las cards rojas tiene opacidad menor a 1.
10. Con el tamaño de fuente del sistema al 200%, ningún texto se recorta ni se superpone.
11. Un lector de pantalla lee el botón de llamada como una frase entendible, no como dígitos sueltos.
12. Tocar dos veces rápido un botón de llamada abre **un solo** marcador.
13. Con una emergencia activa, salir a otra pantalla mantiene el banner persistente.
14. Las 8 variantes son alcanzables y renderizan sin warnings en consola.

---

## 6. Fuera de alcance de esta versión

No implementar, aunque aparezca en conversaciones: chat en vivo con la veterinaria, videollamada, pago dentro de la app, historial completo de emergencias, envío automático de la ficha médica a la clínica, y modo oscuro. Todo eso es v2.

---

## Anexo — Qué cambia respecto de la pantalla actual

Registro explícito de las diferencias entre el diseño que hoy está implementado (el del screenshot) y lo que pide este prompt, para que el cambio sea una decisión y no un accidente:

| Elemento | Hoy | Este prompt | Por qué |
|---|---|---|---|
| Fondo general | Gris/blanco | `#C8F0D8` verde menta | Es el fondo principal definido para Zooni; hoy la pantalla se siente de otra app |
| Emojis en títulos | `🚨` y `📞` como emoji | Íconos vectoriales | Los emojis renderizan distinto en iOS y Android y rompen la línea de base tipográfica |
| Texto de la card B | Tiene una porción con decoración de texto | Texto plano uniforme | Parece un error heredado, no una decisión |
| Placeholder del buscador | Truncado a mitad de palabra | Copy corto + hint al enfocar | Un placeholder cortado se lee como bug |
| Prefijo `Especialidad:` | Presente | Eliminado | Ocupa ancho sin aportar información |
| Distancia y estado horario | Ausentes | Presentes en cada card | Son las dos preguntas reales en una emergencia |
| Acciones por card | Ninguna | `Llamar` + `Cómo llegar` | Hoy hay que entrar al detalle para llamar: un tap de más en una urgencia |
| Chips de filtro | Ausentes | 6 chips, `Abierto ahora` por defecto | Sin filtro de horario el listado puede mandar a una veterinaria cerrada |
| Estados de error / vacío | No definidos | 8 variantes | La pantalla no puede fallar en silencio |
| Bottom tab bar | No visible en el screenshot | Presente, tab `Servicios` activo | Consistencia con el resto de la app |
