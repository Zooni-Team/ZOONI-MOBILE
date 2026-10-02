# Zooni Paseadores — Instrucciones de Diseño y Contexto del Proyecto

## Contexto del Proyecto

Zooni Paseadores es la app hermana de Zooni pensada para los proveedores de servicio de paseo. Mientras que la app de dueños es una vidriera cálida para elegir servicios, esta es una **herramienta de trabajo**: el paseador la usa parado en la calle, con la correa en una mano y el celular en la otra, para aceptar solicitudes, seguir un paseo en el mapa y ver cuánto ganó en el día.

Usa exactamente la misma paleta e identidad de Zooni (misma marca, mismo backend, mismas cuentas de proveedor — la pantalla de login de dueños ya tiene el botón "Registrarse como Proveedor" que deriva acá). Lo que cambia no es el color: cambia la **estructura**. Pasa de ser una vidriera centrada y lúdica a un panel de trabajo alineado a la izquierda, denso en datos (ganancias, tiempo, distancia) y con el mapa como elemento central en vez de la mascota ilustrada.

## Nombre / Sub-marca

**Zooni Paseadores** — mismo isotipo de pata, misma paleta, misma tipografía (Poppins/Nunito) que Zooni. Se reconoce como la misma app desde el primer vistazo; lo que indica "estoy en el modo proveedor" es el layout, no el color.

## Relación con la app de dueños

- Login/registro comparte backend: un mismo usuario puede tener perfil de dueño y de proveedor.
- Las solicitudes que el paseador ve nacen del lado dueño (búsqueda de paseador desde Home/Match).
- El chat es el mismo motor conversacional y el mismo estilo de burbujas.
- Cuando el paseador acepta o finaliza un paseo, el estado se refleja en tiempo real en la app del dueño (y viceversa si el dueño cancela).
- Paleta, tipografía, botones pill y header/nav son 100% compartidos. Lo que diferencia a Zooni Paseadores es la organización de la información: cards de estadísticas, mapa protagonista, listas accionables (aceptar/rechazar) en vez de swipe/match.

## Stack Tecnológico (Mobile)

Igual que Zooni: mobile-first, ancho de referencia ~390px, componentes táctiles con áreas de toque generosas.

## Identidad Visual y Paleta de Colores

Misma paleta que el documento original de Zooni, sin agregar colores nuevos:

| Rol | Color | Hex |
|---|---|---|
| Fondo principal | Blanco roto | #F9FFF9 |
| Fondo de acento (chips, estados, header) | Verde menta suave | #C8F0D8 |
| Cards | Blanco | #FFFFFF |
| Botón primario / CTA (aceptar, iniciar paseo) | Amarillo dorado | #F5C842 |
| Botón secundario | Amarillo claro / crema | #F7D060 |
| Botón urgencia / SOS / rechazar solicitud urgente | Rojo vibrante | #E63946 |
| Acento principal / títulos / nav activo | Verde oscuro / teal | #2DBD72 |
| Texto principal | Gris oscuro | #2C2C2C |
| Texto secundario | Gris medio | #6B6B6B |
| Burbuja de chat (paseador) | Verde menta medio | #A8E6C0 |
| Burbuja de chat (dueño) | Blanco | #FFFFFF |
| Notificación / badge | Naranja / ámbar | #F5A623 |
| Íconos de navegación inactivos | Gris claro | #AAAAAA |

La diferencia con la app de dueños: ahí el verde menta es el fondo principal de pantalla; acá el fondo principal es blanco (más "panel de control", más legible con muchos datos) y el verde menta pasa a ser color de acento — headers, chips de estado ("Disponible"), fondos de sección.

## Elementos Decorativos

- Sin ilustraciones de mascota-personaje como protagonistas de pantalla (esa identidad es de Home/Titán, del lado dueño). Las mascotas se representan como avatar/foto dentro de las cards.
- El mapa (OSM/Google Maps) es un elemento central y recurrente: mini mapa en Home, mapa a pantalla completa en Paseo Activo.
- Se puede mantener el pasto/textura decorativa sutil en login y pantallas de onboarding, como en la app de dueños, para reforzar que es la misma marca.

## Tipografía

Misma que Zooni: títulos en Nunito/Poppins/Fredoka Bold-ExtraBold, texto corrido Regular/Medium desde 14px. Los números grandes (ganancias, tiempo, distancia) van en el peso más pesado disponible para que se lean de un vistazo.

## Componentes Recurrentes y Estilo

### Botones
- Iguales a los de Zooni: pill (border-radius 30px), alto ~52–58px, texto centrado bold, sombra suave.
- Amarillo: acción principal (aceptar, iniciar/finalizar paseo).
- Outline verde teal: acción secundaria.
- Rojo: sólo para rechazar/cancelar con urgencia o el equivalente al SOS.

### Cards
- Blancas, radio 16–20px, sombra suave, padding 16–20px — igual que Zooni.
- Las cards de solicitud y de paseo llevan foto/avatar, nombre, horario y precio siempre en el mismo orden.

### Toggle "Disponible"
- Switch grande en el Home, verde teal cuando está activo, gris claro cuando no. Es el control más importante de la app y por eso el más visible.

### Navegación Inferior (Bottom Tab Bar)
- Igual que Zooni: fondo blanco, tab activo en verde teal con label bold, tabs inactivos en gris claro.
- Tabs: Inicio, Solicitudes, Paseo, Ganancias, Perfil.

### Header / AppBar
- Fondo blanco o verde menta suave, igual que Zooni, pero alineado a la izquierda (nombre del paseador + avatar) en vez de centrado — es el único quiebre real de patrón, porque acá no hay un título de sección para centrar sino un estado de trabajo.
- Campana con badge naranja/ámbar a la derecha, igual que Zooni.

### Mapa / Tracking (Paseo Activo)
- Mapa a pantalla completa; card flotante blanca abajo con mascota, timer y distancia en números grandes, y los botones Pausar/Finalizar.

### Chat
- Mismas burbujas redondeadas estilo iMessage que Zooni: verde menta medio para el paseador, blanco para el dueño.

## Tono y Voz

- Mismo tono cercano y tuteo de Zooni, pero con frases más cortas y orientadas a la acción: "tenés una solicitud nueva", "iniciá el paseo cuando estés listo", "cobraste $X esta semana".
- Emojis permitidos con moderación, igual que en el resto de la app.

## Pantallas de la App (todas las tabs)

1. **Login / Registro Paseador** — comparte flujo con el login de dueños.
2. **Inicio (Home)** — tab 1: toggle Disponible, resumen del día, próximo paseo.
3. **Solicitudes** — tab 2: lista de pedidos entrantes con aceptar/rechazar.
4. **Paseo** — tab 3: mapa a pantalla completa cuando hay un paseo activo, timer, chat con el dueño.
5. **Ganancias** — tab 4: historial de paseos completados, total cobrado, filtros por semana/mes.
6. **Perfil** — tab 5: rating, reseñas, servicios ofrecidos, acceso a configuración.
7. **Chat** — pantalla accesible desde una solicitud o un paseo activo, no es tab de bottom nav.
8. **Configuración de disponibilidad** — accesible desde Perfil: horarios y zonas en las que trabaja.

Las ocho se maquetan a continuación como referencia visual.

## Instrucciones para Nuevas Pantallas

1. Usar exactamente la paleta de esta tabla, sin introducir colores nuevos.
2. Fondo blanco como base, verde menta como color de acento (headers, chips, estados) — no como fondo de pantalla completo.
3. Botones pill, iguales a los de Zooni.
4. Header alineado a la izquierda con nombre/avatar del paseador; el resto de los patrones (nav, cards, chat) igual que en Zooni.
5. Todo dato numérico importante (tiempo, distancia, dinero) en el peso de fuente más pesado y tamaño grande.
6. Mascotas representadas como foto/avatar real, no como personaje ilustrado.

Este documento es la fuente de verdad de diseño para Zooni Paseadores y se lee junto con el doc de Zooni (dueños): comparten marca, paleta y componentes; lo que cambia a propósito es la estructura de la información.
