# Zooni — Instrucciones Generales de Diseño y Contexto del Proyecto
 
## Contexto del Proyecto
 
Somos estudiantes de 5to año de Informática en el **Colegio ORT Argentina** y estamos desarrollando **Zooni**, una aplicación mobile que **centraliza los distintos servicios para mascotas**: veterinarias, paseadores, pet shops, peluquerías caninas, y más.
 
La app tiene como objetivo ser el punto de encuentro entre dueños de mascotas y proveedores de servicios, permitiendo además la interacción entre usuarios con mascotas (comunidad, match entre mascotas, mapa de amigos, etc.).
 
---
 
## Nombre de la App
 
**Zooni**
 
---
 
## Stack Tecnológico (Mobile)
 
- La aplicación es **mobile-first**, diseñada para pantallas de smartphones (ancho de referencia: ~390px).
- Las pantallas deben respetar proporciones móviles típicas.
- Los componentes deben tener bordes redondeados, ser táctiles (áreas de toque generosas) y seguir patrones UX mobile modernos.
---
 
## Identidad Visual y Paleta de Colores
 
La identidad de Zooni es **amigable, colorida y accesible**, orientada a dueños de mascotas de todas las edades. El estilo es **flat design con ilustraciones redondeadas y animadas**, transmitiendo calidez y confianza.
 
### Paleta Principal
 
| Rol | Color | Hex aproximado |
|---|---|---|
| Fondo principal | Verde menta suave | `#C8F0D8` / `#D4F5E2` |
| Fondo secundario / cards | Blanco roto | `#FFFFFF` / `#F9FFF9` |
| Botón primario / CTA principal | Amarillo dorado | `#F5C842` / `#F0C430` |
| Botón secundario | Amarillo más claro / crema | `#F7D060` |
| Botón de peligro / urgencia (SOS) | Rojo vibrante | `#E63946` / `#F03040` |
| Acento principal / títulos | Verde oscuro / teal | `#2DBD72` / `#27AE60` |
| Texto principal | Gris oscuro | `#2C2C2C` |
| Texto secundario / subtítulos | Gris medio | `#6B6B6B` |
| Burbuja de chat (usuario) | Verde menta medio | `#A8E6C0` |
| Burbuja de chat (bot) | Blanco | `#FFFFFF` |
| Íconos de navegación activos | Verde teal | `#2DBD72` |
| Íconos de navegación inactivos | Gris claro | `#AAAAAA` |
| Notificación / badge | Naranja / ámbar | `#F5A623` |
 
### Elementos Decorativos
 
- El fondo principal usa una textura o ilustración sutil de **pasto verde** en la parte inferior de la pantalla hero.
- Se usan **ilustraciones flat de mascotas** (perros, gatos) como elementos centrales de las pantallas principales. Estilo redondeado, sin bordes duros, colores suaves.
- Las ilustraciones deben sentirse **lúdicas pero prolijas**, no infantiles en exceso.
---
 
## Tipografía
 
- **Títulos y nombres de pantalla**: Fuente redondeada, amigable. Referencia: `Nunito`, `Poppins`, o `Fredoka One`. Peso Bold o ExtraBold.
- **Texto de botones**: Bold, legible, centrado.
- **Texto corrido / subtítulos**: Regular o Medium, tamaño mínimo 14px para legibilidad mobile.
- Los textos sobre fondos de color deben tener suficiente contraste (blanco sobre verde oscuro, negro/gris oscuro sobre amarillo).
---
 
## Componentes Recurrentes y Estilo
 
### Botones
- Bordes muy redondeados (`border-radius: 30px` o `pill shape`).
- Altura generosa (~52–58px).
- Texto centrado en bold.
- Los botones amarillos son la acción principal de cada pantalla.
- El botón rojo SOS es siempre el último y el de mayor urgencia visual.
- Sombra suave debajo de cada botón para dar profundidad (`box-shadow: 0 4px 8px rgba(0,0,0,0.12)`).
### Cards / Contenedores
- Fondo blanco con bordes redondeados (`border-radius: 16–20px`).
- Sombra suave.
- Padding interno generoso (~16–20px).
### Navegación Inferior (Bottom Tab Bar)
- Fondo blanco.
- Íconos con label de texto debajo.
- El tab activo se destaca en verde teal con texto en bold.
- Tabs presentes: **Amigos**, **Servicios**, **Solicitudes**, **Buscar** (puede variar por pantalla).
### Header / AppBar
- Fondo blanco o verde menta muy suave.
- Título de la sección centrado, en bold, verde oscuro.
- Ícono de hamburguesa (☰) a la izquierda.
- Ícono de notificación (🔔) a la derecha, con badge naranja cuando hay alertas.
### Burbujas de Chat
- Alineadas a la derecha (usuario): fondo verde menta `#A8E6C0`, texto gris oscuro.
- Alineadas a la izquierda (bot/Zooni): fondo blanco con borde sutil, texto gris oscuro.
- Bordes completamente redondeados, estilo iMessage.
- Input de texto al fondo con placeholder descriptivo y botón de envío amarillo redondo.
---
 
## Tono y Voz
 
- **Amigable y cercano**: tutear al usuario, lenguaje informal pero profesional.
- **Positivo y empático**: la app ama a las mascotas tanto como sus dueños.
- Textos cortos y claros. Evitar tecnicismos innecesarios.
- Emojis permitidos en contextos de chat y mensajes de sistema (con moderación).
---
 
## Pantallas Existentes (Referencia)
 
Las siguientes pantallas ya están diseñadas y deben usarse como referencia estricta de estilo para cualquier pantalla nueva:
 
1. **Home (`Titán`)** — Pantalla principal con mascota ilustrada, nombre del usuario y botones de navegación (Comunidad, Ficha Médica, Mis Mascotas, SOS Veterinario).
2. **Chat Zooni** — Asistente AI de la app. Muestra el nombre y raza de la mascota como contexto. Burbujas de chat estilo conversacional.
3. **Match** — Pantalla estilo Tinder con foto de mascota a pantalla completa, nombre del dueño, edad y ubicación. Botones de acción: ❌ rechazar, ⭐ favorito, ✅ aceptar.
4. **Perfil de Usuario** — Avatar circular con borde verde, nombre del usuario, estadísticas (publicaciones, seguidores, siguiendo), botón "Hacer seguimiento".
5. **Mapa de Amigos** — Mapa interactivo (OpenStreetMap / Google Maps) con ubicación en tiempo real, botones flotantes para agregar amigos y crear carteles, y bottom sheet con lista de amigos y filtros.
---
 
## Instrucciones para Nuevas Pantallas
 
Cuando diseñes una nueva pantalla para Zooni, debés seguir estrictamente estas reglas:
 
1. **Respetar la paleta de colores definida arriba**. No introducir colores nuevos sin justificación.
2. **Mantener el estilo de botones pill** con las alturas y radios especificados.
3. **Usar el mismo header** con hamburguesa, título centrado y campana de notificación.
4. **Usar la barra de navegación inferior** cuando la pantalla lo requiera.
5. **Las ilustraciones de mascotas** deben seguir el estilo flat, redondeado y colorido ya establecido.
6. **El fondo principal debe ser el verde menta suave** (`#C8F0D8`), salvo en pantallas donde predomine contenido (mapa, perfil, etc.).
7. Toda nueva pantalla debe sentirse como parte de la misma familia visual: **cálida, amigable, mobile-first**.
---
 
## Próximas Pantallas a Diseñar
 
Las siguientes pantallas serán especificadas en instrucciones separadas y deben adherirse al presente documento como base:
 
- **Home** (versión detallada con variantes)
- **Match** (flujo completo)
- **Comunidad** (feed, publicaciones, interacciones)
---
 
*Este documento es la fuente de verdad de diseño para Zooni. Cualquier componente, pantalla o flujo nuevo debe partir de estas definiciones.*
 