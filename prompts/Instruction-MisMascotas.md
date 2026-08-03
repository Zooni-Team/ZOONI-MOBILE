PROMPT — Sección Mis Mascotas / Configuración de Mascotas (Zooni)

Destino: Claude Code / Cursor Backend: Supabase (PostgreSQL + Storage + RLS + Edge Functions) Alcance: pantalla índice + ciclo de vida completo (alta, edición, archivado, recuperación, eliminación) + 9 variantes de estado Versión: 1.0 Hermanos: prompt-pantalla-sos.md y prompt-pantalla-configuracion.md — comparten tokens y reglas de accesibilidad Entrada: Configuración → fila Mis Mascotas (definida en prompt-pantalla-configuracion.md, sección 3.5.5)

0. Cómo usar este prompt

Dos ramas:

Rama A — FRONTEND (secciones 2 a 6): índice, cards, ciclo de vida, formulario de alta y edición, estados.
Rama B — BACKEND (sección 7): esquema, storage, seguridad, efectos en cascada.

Reglas duras:

No inventar colores. Solo los tokens de 3.1. Los tokens -text son obligatorios para tipografía.
No inventar copys. Todos los literales están entre comillas.
Archivar no es eliminar y eliminar no es archivar. Es la distinción central de esta pantalla y tiene que ser evidente en el color, el peso visual, el copy y la ubicación de cada botón. Si un usuario archiva creyendo que borra, o borra creyendo que archiva, la pantalla falló.
Nada se pierde sin confirmación explícita. Archivar es reversible con un toque; eliminar exige confirmación escrita y tiene 30 días de gracia.
Mobile-first, 390px de referencia. Correcto entre 320px y 430px.
1. Contexto de la sección

Qué es: el lugar donde el usuario administra el ciclo de vida de sus mascotas dentro de Zooni. Las mascotas son la entidad central de la app: de ellas cuelgan la ficha médica, los paseos, el Match, la Home y el chat con el asistente. Todo lo que pasa acá se propaga al resto de la app.

Los tres estados de una mascota:

Estado	Qué significa	Reversible	Aparece en la app
Activa	Vive con el usuario, es parte de su día a día	—	Sí, en todos lados
Archivada	Sigue existiendo con toda su información, pero no está en la vida diaria del usuario	Sí, con un toque	No
Eliminada	Se borra ella y todo lo suyo	Solo dentro de 30 días	No

Por qué existe el archivado. Está pensado para el tránsito de mascotas y para veterinarias y lugares de cuidado: una casa de tránsito recibe un perro, le carga la ficha médica, lo cuida dos meses y lo entrega en adopción. Ese perro no se borra — su historial médico importa, y puede volver. Lo mismo para una veterinaria o guardería que administra animales que entran y salen.

Consecuencias de diseño que salen de ahí:

El archivado preserva absolutamente todo: ficha médica, vacunas, fotos, historial de paseos, peso histórico. Es lo que lo diferencia de eliminar.
Un mismo usuario puede tener muchas mascotas archivadas. La lista de archivadas necesita buscador y contador desde el día uno, no cuando ya hay 40.
Archivar y recuperar tienen que ser baratos: un toque, un diálogo corto, con opción de deshacer. No son acciones excepcionales, son parte del flujo de trabajo de estos usuarios.
Eliminar, en cambio, tiene que ser caro: confirmación escrita, lista de lo que se pierde, y período de gracia.

Tono de voz: cálido y concreto. Las mascotas se nombran por su nombre en todos los copys (¿Archivar a Titán?, nunca ¿Archivar esta mascota?). En las acciones destructivas, el tono baja a informativo y preciso: acá el usuario necesita entender, no que lo acompañen emocionalmente.

2. Punto de entrada y navegación
2.1 Cómo se llega
Principal: Configuración → Mis Mascotas. La fila muestra como valor secundario la cantidad de activas (3 mascotas).
Secundario: Home → toque largo sobre la mascota activa → Administrar mis mascotas.
Secundario: estado vacío de Home (ver 6.V9) → botón Agregar mi mascota, que entra directo al formulario de alta salteando el índice.
Deep link: zooni://pets, y zooni://pets/new para el alta directa.
2.2 Mapa de navegación
Configuración
   └── Configuración de Mascotas  (índice, sección 3)
         ├── + Agregar nueva mascota  → Wizard de alta, 4 pasos  (sección 5)
         ├── Card activa
         │     ├── toque en la card → Detalle de mascota          (sección 4)
         │     ├── Editar            → Formulario de edición      (sección 5.6)
         │     ├── Archivar          → Diálogo de archivado       (sección 4.2)
         │     └── ⋮ menú
         │           ├── Ver ficha médica  → pantalla existente
         │           ├── Marcar como principal
         │           └── Eliminar    → Pantalla de eliminación    (sección 4.4)
         └── Card archivada
               ├── toque en la card → Detalle (solo lectura)
               ├── Recuperar        → Diálogo de recuperación     (sección 4.3)
               └── ⋮ menú → Eliminar
2.3 Transiciones y salida
Push horizontal, 250ms ease-out, igual que el resto de Zooni.
El ícono ☰ del header abre el drawer, no funciona como "atrás". Para volver a Configuración se usa el swipe-back nativo o el botón físico de Android.
⚠️ Corrección respecto del diseño actual: al ser una sub-pantalla de Configuración, el header debería tener una flecha ←, no la hamburguesa. Ver el anexo.
Sin bottom tab bar, igual que Configuración.
Salir del formulario de alta o edición con cambios sin guardar dispara ¿Descartar los cambios? con Descartar y Seguir editando.
RAMA A — FRONTEND
3. Pantalla índice — "Configuración de Mascotas"
3.1 Tokens de estilo

Hereda la tabla de prompt-pantalla-sos.md. Tokens usados y los que agrega:

Token	Hex	Uso
--bg-top	
#E4F9EA	Extremo superior del degradado de fondo
--bg-bottom	
#A8E6BC	Extremo inferior del degradado, donde está la ilustración de pasto
--grass	
#8FDCA8	Ilustración de pasto y hojas, al 70% de opacidad
--surface	
#FFFFFF	Card de mascota
--surface-archived	
#F1F7F3	Token nuevo. Fondo de la card archivada — un gris verdoso opaco, no la card blanca con opacidad reducida del diseño actual
--text	
#2C2C2C	Nombre, títulos de sección, texto sobre fondos claros
--text-soft	
#6B6B6B	Especie y raza, textos de estado vacío
--text-soft-mint	
#5A6B60	Texto secundario sobre el fondo menta
--brand	
#2DBD72	Anillo del avatar de una mascota activa, rellenos decorativos
--brand-text	
#177046	Texto e íconos verdes, relleno de Recuperar, línea bajo los títulos de sección
--ring-archived	
#7E9089	Token nuevo. Anillo del avatar de una mascota archivada (gris verdoso, no verde). 
#B9C6BE daría 1.63:1 sobre la card y no se vería
--chip-archived-text	
#4A5550	Token nuevo. Texto del chip Archivada sobre 
#E2EAE5 (--text-soft ahí da 4.35:1, apenas por debajo del mínimo)
--cta	
#F5C842	Botón + Agregar nueva mascota y botón Editar, siempre con texto --text
--cta-soft	
#F7D060	Estado pressed del CTA
--neutral-btn	
#EDF3EF	Token nuevo. Fondo del botón Archivar (acción reversible, neutra)
--sos-red-text	
#B3121D	Eliminar y textos de error
--sos-red-tint	
#FDECEE	Fondo de bloques destructivos
--toast-bg	
#C9EBD4	Fondo del toast de confirmación
--divider	
#E8EFE9	Separadores
3.2 Tipografía
Rol	Peso	Tamaño
Título de pantalla (Configuración de Mascotas)	ExtraBold (800)	22px
Título de sección (Activas, Archivadas)	Bold (700)	17px
Contador de sección	SemiBold (600)	14px
Nombre de la mascota (card activa)	ExtraBold (800)	20px
Nombre de la mascota (card archivada)	Bold (700)	18px
Especie · raza	Regular (400)	14px
Texto de botón	Bold (700)	15px
Texto de estado vacío	Regular (400)	14px
Texto del toast	SemiBold (600)	14px
3.3 Anatomía
┌─────────────────────────────────────────┐
│ ←                                       │  ← A. Header
│                                         │
│  🐾 Configuración de Mascotas           │  ← B. Título
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ ✓ Mascota archivada correctamente │  │  ← C. Toast (efímero)
│  │                          Deshacer │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │      +  Agregar nueva mascota     │  │  ← D. CTA principal
│  └───────────────────────────────────┘  │
│                                         │
│  Activas                            (1) │  ← E. Título de sección
│  ─────────────────────────────────────  │
│  ┌───────────────────────────────────┐  │
│  │                              ⋮    │  │  ← F. Card activa
│  │              ╭───────╮            │  │
│  │              │  🐕   │            │  │
│  │              ╰───────╯            │  │
│  │               Titán               │  │
│  │      Perro · Labrador Retriever   │  │
│  │        3 años · Principal         │  │
│  │  ┌─────────┐        ┌───────────┐ │  │
│  │  │ Editar  │        │ Archivar  │ │  │
│  │  └─────────┘        └───────────┘ │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Archivadas                         (0) │
│  ─────────────────────────────────────  │
│  ┌───────────────────────────────────┐  │
│  │    No hay mascotas archivadas.    │  │  ← G. Estado vacío de sección
│  └───────────────────────────────────┘  │
│                                         │
│  [ ilustración de pasto y hojas ]       │  ← H. Fondo decorativo
└─────────────────────────────────────────┘
3.4 Componentes
A. Header
Alto 52px + safe area. Fondo transparente sobre el degradado.
Izquierda: flecha ← de 24px, trazo 2.5px, color --text. Área táctil 44×44px a 16px del borde. Vuelve a Configuración.
⚠️ El diseño actual muestra la hamburguesa ☰. Es una sub-pantalla de segundo nivel: corresponde flecha atrás. Ver anexo.
Sin título en el header (el título grande está debajo). Sin campana.
B. Título de pantalla
Texto Configuración de Mascotas — Nunito ExtraBold 22px, --text, alineado a la izquierda a 16px del borde, con 20px de margen superior e inferior.
A la izquierda del texto, separado 8px: ícono de huella de 20px en --brand-text. Reemplaza el emoji 🐾 del diseño actual por un vectorial, por las mismas razones que en el resto de la app (los emojis no se tiñen, cambian entre plataformas y ensucian el lector de pantalla).
En 320px el título entra en dos líneas antes de reducir el tamaño.
C. Toast de confirmación

Aparece tras archivar, recuperar, crear o editar. Efímero, no bloqueante.

Ancho: 100% menos 16px por lado. Alto mínimo 48px, padding 12px 16px. border-radius: 12px.
Fondo --toast-bg 
#C9EBD4 opaco (el diseño actual usa translucidez, que hace impredecible el contraste según lo que quede detrás). Sin borde. Sombra 0 2px 6px rgba(0,0,0,0.10).
Ícono de check de 18px en --brand-text a la izquierda + 10px de gap + texto SemiBold 14px --text.
A la derecha, acción Deshacer en Bold 14px --brand-text, con área táctil de 44px.
⚠️ Falta en el diseño actual y es lo más importante que se puede agregar acá. Archivar la única mascota activa vacía la Home; poder deshacerlo en el acto evita el susto.
Duración: 6 segundos (más que el estándar de 4, porque tiene una acción). Se puede descartar con swipe hacia arriba. Si aparece otro toast, el anterior se reemplaza, no se apila.
Copys literales: Mascota archivada correctamente · Titán volvió a tus mascotas activas · Titán se agregó a tus mascotas · Cambios guardados.
Anuncio al lector de pantalla con accessibilityLiveRegion="polite".
D. CTA + Agregar nueva mascota
Ancho 100% menos 16px por lado. Alto 52px. border-radius: 30px (pill).
Fondo --cta 
#F5C842 con texto --text 
#2C2C2C en Nunito Bold 16px, centrado, con un ícono + de 18px a la izquierda del texto separado 8px.
⚠️ Cambio respecto del diseño actual, por dos razones convergentes. Primera: en Zooni el CTA primario de cada pantalla es amarillo — el verde no es un color de botón principal en el sistema. Segunda y decisiva: el botón actual es blanco sobre 
#2DBD72, que da 2.43:1 y no pasa ni de cerca el mínimo de 4.5:1. Amarillo con texto oscuro da 8.79:1.
Si por decisión de producto se quiere mantener el verde, el único verde admisible con texto blanco es --brand-text 
#177046 (6.10:1). El 
#2DBD72 no es una opción.
Sombra 0 4px 8px rgba(0,0,0,0.12). :pressed → --cta-soft + scale(0.98), 120ms.
Se muestra siempre, incluso cuando no hay ninguna mascota y cuando solo hay archivadas.
Deshabilitado (opacidad 45%, sin respuesta) si se alcanzó el límite de mascotas. Ver 7.6.
E. Título de sección
Texto Activas / Archivadas en Nunito Bold 17px --text, alineado a la izquierda.
Contador a la derecha, en SemiBold 14px --text-soft-mint, entre paréntesis: (1), (12). No existe en el diseño actual; con la lista de archivadas creciendo es información necesaria de un vistazo.
Debajo, a 6px, línea divisoria de 2px en --brand-text 
#177046, de borde a borde del contenido.
⚠️ El diseño actual usa 
#2DBD72, que sobre el fondo claro da 2.15:1 y no llega al 3:1 mínimo de elementos gráficos. 
#177046 da 5.40:1.
El emoji 📦 que hoy acompaña a Archivadas se reemplaza por un ícono vectorial de caja de 16px en --text-soft-mint, a la derecha del texto.
Ambas secciones se muestran siempre, incluso vacías. Que el usuario vea que existe la sección Archivadas es lo que le enseña que el archivado existe.
Sección Archivadas colapsable cuando tiene más de 5 elementos: el título se vuelve tocable, con un chevron que rota 180° en 200ms. Arranca colapsada si hay más de 10.
Buscador dentro de Archivadas cuando hay más de 8: input pill de 44px, placeholder Buscar mascota archivada, filtra por nombre y raza con debounce de 300ms. Es el caso de uso de veterinarias y casas de tránsito.
F. Card de mascota activa
Ancho 100% menos 16px por lado. border-radius: 20px. Fondo --surface 
#FFFFFF. Sombra 0 4px 8px rgba(0,0,0,0.12). Padding 20px 16px 16px. Separación entre cards: 12px.
Toda la card es tocable y navega al Detalle de mascota (sección 4), excepto las áreas de los botones y del menú ⋮.

Contenido, centrado verticalmente en columna:

Menú ⋮ — arriba a la derecha, ícono de 20px --text-soft, área táctil 44×44px. Abre un bottom sheet con: Ver ficha médica, Marcar como principal (oculto si ya lo es), Compartir ficha, y Eliminar separado por un divisor y en --sos-red-text.
⚠️ Eliminar va acá y no en la cara de la card. Tres botones visibles en una card de este ancho quedan apretados, y poner una acción irreversible al lado de una reversible es la receta para que alguien borre a su perro creyendo que lo archivaba.
Avatar — círculo de 104px, centrado. Borde de 3px --brand 
#2DBD72. Contenido: la foto real de la mascota recortada al círculo; si no hay foto, la ilustración flat por defecto según la especie (perro, gato, otro), en el estilo redondeado y colorido de Zooni, sobre fondo 
#FFFFFF.
Si la mascota es la principal, chip Principal superpuesto al borde inferior del avatar: fondo --brand-text, texto blanco Bold 11px, padding 3px 10px, border-radius: 10px.
Nombre — Titán, Nunito ExtraBold 20px --text, centrado, margen superior 12px. Máximo 1 línea con ellipsis.
Especie y raza — Perro · Labrador Retriever, Regular 14px --text-soft, centrado, margen superior 4px.
⚠️ El diseño actual usa un guion (Perro - Labrador Retriever). Se cambia por un punto medio ·, que es el separador que ya usa el resto de la app.
Línea de metadatos — 3 años · 28 kg, SemiBold 13px --text-soft-mint, centrado, margen superior 2px. No existe en el diseño actual. Se calcula la edad desde la fecha de nacimiento; si no hay fecha, se omite el fragmento sin dejar el separador colgando.
Fila de botones — margen superior 16px, space-between, ambos de alto 40px y border-radius: 20px:
Editar — fondo --cta 
#F5C842, texto --text Bold 15px, ícono de lápiz 15px. Ancho: flex 1. 8.79:1 ✅, se mantiene tal cual está.
Archivar — fondo --neutral-btn 
#EDF3EF, texto --brand-text Bold 15px, borde 1.5px solid var(--brand-text), ícono de caja 15px. Ancho: flex 1. Gap entre botones: 12px.
⚠️ Cambio importante. El diseño actual pinta Archivar de rojo coral 
#F5626C, que además de dar solo 3.07:1 con texto blanco, comunica lo contrario de lo que hace: el rojo en Zooni está reservado para lo destructivo y lo urgente (SOS). Archivar es reversible, no destructivo, y no debe verse como el botón peligroso de la card. El rojo queda libre para Eliminar, que es el que sí lo necesita.
G. Card de mascota archivada

Misma estructura que la activa, con estas diferencias:

Fondo --surface-archived 
#F1F7F3 opaco, no blanco translúcido. Sombra más leve: 0 2px 6px rgba(0,0,0,0.08).
⚠️ Cambio de accesibilidad. El diseño actual baja la opacidad de toda la card para comunicar "archivada". Bajar la opacidad de un contenedor arrastra el contraste de todo lo que tiene adentro a un valor impredecible que depende del fondo, y con el filtro de escala de grises del sistema el estado deja de distinguirse. Se reemplaza por un fondo opaco distinto + un chip explícito.
Chip Archivada arriba a la izquierda de la card: fondo 
#E2EAE5, texto --chip-archived-text 
#4A5550 Bold 11px (6.33:1), ícono de caja de 12px, border-radius: 10px, padding 4px 10px. El estado nunca se comunica solo por color o por opacidad: siempre hay una palabra.
Avatar de 72px (más chico que el activo, como en el diseño actual), con borde de 3px --ring-archived 
#7E9089 en vez de verde. La foto o ilustración va desaturada al 60% (saturate(0.6)), no con opacidad reducida: baja la carga visual sin tocar el contraste del texto.
Nombre en Bold 18px --text (no ExtraBold 20px).
Fecha de archivado — línea adicional bajo la raza: Archivada el 12/07/2026, Regular 12px --text-soft, centrada. Y si se registró un motivo, se muestra debajo: Terminó el tránsito.
Un solo botón Recuperar — alto 40px, border-radius: 20px, fondo --brand-text 
#177046 con texto blanco Bold 15px e ícono de flecha circular. Ancho: 100% del contenido de la card.
⚠️ El diseño actual usa un verde claro con texto blanco que da 1.78:1 — es prácticamente ilegible. 
#177046 con blanco da 6.10:1.
En el diseño actual el botón está alineado a la izquierda y ocupa poco ancho; se pasa a ancho completo porque es la única acción de la card y no compite con nada.
Menú ⋮ con Ver ficha médica (solo lectura), Ver detalle y Eliminar.
H. Fondo decorativo
Degradado vertical de --bg-top 
#E4F9EA (arriba) a --bg-bottom 
#A8E6BC (abajo).
Ilustración de pasto y hojas en --grass 
#8FDCA8 al 70% de opacidad, anclada al borde inferior de la pantalla, ocupando el ancho completo con altura de ~180px, más hojas sueltas asomando por el borde derecho a la altura media. Es la misma familia de ilustración de la Home.
Se dibuja siempre detrás de todo el contenido, con pointer-events: none, y se marca como decorativa para el lector de pantalla.
El contenido scrollea por encima; la ilustración queda fija al viewport, no scrollea con el contenido.
4. Ciclo de vida de una mascota
4.1 Detalle de mascota

Se abre al tocar cualquier card. Header con ← y el nombre de la mascota como título.

Cabecera: foto grande a sangre completa de 240px de alto con degradado oscuro en la base, nombre en ExtraBold 26px blanco superpuesto abajo a la izquierda, y chip de estado (Principal / Archivada) al lado.
Grupo "Sobre <nombre>" en cards blancas, con filas SettingsInfo: especie, raza, sexo, fecha de nacimiento (con la edad calculada al lado), fecha de adopción o ingreso (con el tiempo transcurrido), peso, tamaño, color, castrado, microchip, señas particulares.
Grupo "Salud": acceso a Ficha médica, Vacunas con la próxima pendiente destacada, Alergias y condiciones, Veterinaria de cabecera.
Grupo "Actividad": Historial de paseos, Fotos, Matches.
Pie de acciones: Editar, Archivar o Recuperar según el estado, y Eliminar en --sos-red-text.
Si la mascota está archivada, todo el detalle es de solo lectura: los campos se muestran pero no se editan, y arriba aparece un banner Esta mascota está archivada. Recuperala para poder editarla. con el botón Recuperar.
4.2 Archivar

Disparadores: botón Archivar de la card activa, o la acción del detalle.

Diálogo — bottom sheet de ~380px, border-radius: 24px 24px 0 0, scrim rgba(0,0,0,0.4):

Avatar de 56px de la mascota arriba, centrado.
Título: ¿Archivar a Titán? — ExtraBold 19px --text, centrado.
Cuerpo: Se guarda toda su información: ficha médica, vacunas, fotos e historial de paseos. Podés recuperarla cuando quieras. — Regular 14px --text-soft, centrado.
Bloque "Mientras esté archivada" — fondo 
#F1F7F3, border-radius: 12px, padding 12px, con tres líneas de 13px --text-soft y su ícono:
No va a aparecer en tu inicio ni en Match.
No vas a recibir recordatorios de sus vacunas.
No vas a poder registrar paseos con ella.
Selector de motivo (opcional) — SettingsSelect con label Motivo y valor por defecto Sin especificar. Opciones: Terminó el tránsito · Fue adoptada · Está al cuidado de otra persona · Quedó en la veterinaria · Ya no vive conmigo · Otro. Si se elige Otro, aparece un campo de texto de 60 caracteres.
El motivo se muestra después en la card archivada y en el detalle. Para una casa de tránsito con 30 mascotas archivadas, es lo que hace la lista utilizable.
Botones: Archivar (pill 52px, fondo --brand-text, texto blanco Bold 16px) y debajo Cancelar (texto --text-soft Bold 16px, sin fondo).

Al confirmar:

La card sale de Activas con una animación de 250ms: se desvanece y colapsa su alto, y las de abajo suben.
Entra en Archivadas con un fade de 200ms, ordenada por fecha de archivado descendente.
Toast Mascota archivada correctamente con Deshacer.
Escritura optimista con rollback: si el backend falla, la card vuelve a Activas y el toast cambia a error.
Si era la mascota principal, la más antigua de las activas restantes pasa a ser principal automáticamente, y el toast lo dice: Ahora Luna es tu mascota principal. Si no queda ninguna activa, no hay principal y la Home pasa al estado vacío (6.V9).
4.3 Recuperar

Acción de baja fricción: no lleva bottom sheet.

Toque en Recuperar → la card se mueve de Archivadas a Activas con la animación inversa, y aparece el toast Titán volvió a tus mascotas activas con Deshacer.
Excepción: si al recuperar se superaría el límite de mascotas activas, sí aparece un diálogo explicando que hay que archivar otra primero.
Excepción: si la mascota estuvo archivada más de 6 meses, aparece un diálogo corto sugiriendo revisar los datos: Hace un tiempo que Titán está archivado. ¿Querés revisar su peso y sus vacunas? con Revisar datos y Recuperar sin revisar.
Al recuperar, la mascota no vuelve a ser principal automáticamente; conserva el orden por fecha de alta.
Los recordatorios de vacunas se reactivan, recalculando las fechas vencidas: si hay vacunas atrasadas, la ficha médica lo marca en ámbar.
4.4 Eliminar

Nunca es un diálogo simple. Abre una pantalla dedicada con header ← y título Eliminar a Titán.

Avatar de 80px, centrado, en escala de grises.
Bloque --sos-red-tint con border-radius: 16px, título Qué se borra en Bold 15px --sos-red-text, y la lista exacta con íconos:
Su perfil y todas sus fotos
Su ficha médica y el historial de vacunas
Su historial de paseos y recorridos
Sus matches y conversaciones asociadas
Su historial de peso y controles
Alternativa sugerida — card blanca con ¿Preferís archivarla? en Bold 15px, texto Si la archivás no perdés nada y podés recuperarla cuando quieras. y botón Archivar en vez de eliminar (pill, fondo --brand-text, texto blanco). Este bloque va antes que el de confirmación: mucha gente que llega acá en realidad quiere archivar.
Confirmación escrita — solo si la mascota tiene ficha médica, historial de paseos o más de 5 fotos. Label: Escribí "Titán" para confirmar, input de 48px con borde 1.5px --divider, que pasa a --sos-red-text cuando el texto no coincide y a --brand-text cuando coincide. Comparación insensible a mayúsculas y a tildes.
Checkbox Entiendo que esto no se puede deshacer. — casilla de 22px, área táctil 44px.
Botón Eliminar a Titán — pill 52px, fondo 
#FFFFFF, borde 2px solid var(--sos-red-text), texto --sos-red-text Bold 16px. Deshabilitado (opacidad 45%) hasta que el texto coincida y el checkbox esté tildado.
Debajo, Cancelar en texto --text-soft.
Período de gracia de 30 días: la mascota se marca deleted y desaparece de toda la app, pero los datos se conservan. Decirlo en la pantalla de confirmación final: Tenés 30 días para recuperarla escribiéndonos a soporte. Después se borra definitivamente.
Es coherente con el borrado de cuenta especificado en prompt-pantalla-configuracion.md.
Al terminar, vuelve al índice con el toast Titán se eliminó. Este toast no lleva Deshacer — la recuperación es por soporte, no por un toque, y ofrecer un deshacer que después no existe sería mentir.
4.5 Estado "En memoria" (recomendado, no está en el diseño actual)

Una de las opciones de archivado tiene que ser distinta a las demás: la mascota falleció. Tratarla como "archivada, motivo: otro" es frío y hace que el usuario tenga que elegir entre ver el recordatorio de vacunas de un animal que murió o borrarlo entero.

Se agrega el motivo Falleció en el selector de archivado.
Al elegirlo, la mascota pasa a la sección En memoria (una tercera sección, debajo de Archivadas), no a Archivadas.
La card muestra el avatar con un anillo dorado suave 
#E8D9A8, el nombre, las fechas 2019 – 2026, y un solo botón Ver recuerdos que abre las fotos y el historial.
Nunca se le mandan recordatorios de vacunas ni notificaciones de ningún tipo.
Se puede eliminar, pero nunca se sugiere hacerlo.
Copy del diálogo: Lamentamos tu pérdida. Guardamos las fotos y los recuerdos de Titán. No vas a recibir más recordatorios sobre él.
5. Alta y edición de mascota

El alta es el mismo formulario que el registro, aislado: los mismos campos, las mismas validaciones y el mismo diseño, pero creando una sola mascota y sin los pasos de cuenta de usuario.

5.1 Formato

Wizard de 4 pasos con barra de progreso, no un formulario largo de una pantalla. Con ~20 campos, un scroll único abandona.

Barra de progreso: 4 segmentos de 4px, border-radius: 2px, gap 6px, ancho completo menos 16px por lado, debajo del header. Completados y actual en --brand-text, pendientes en 
#D8E5DC. Encima, texto Paso 2 de 4 en SemiBold 13px --text-soft-mint.
Header: ← a la izquierda (retrocede un paso, o sale en el paso 1), título del paso centrado en Bold 17px, y Cancelar a la derecha en Bold 15px --text-soft.
Pie fijo: botón Continuar (pill 52px, --cta, texto --text Bold 16px, ancho completo) y en el paso 4 Guardar mascota. El botón se deshabilita si el paso tiene campos obligatorios sin completar, y muestra un loader circular de 20px mientras guarda.
Se puede salir y volver: el borrador se guarda localmente y al reabrir el alta aparece ¿Seguís cargando a Titán? con Continuar y Empezar de nuevo.
Solo el nombre y la especie son obligatorios. Todo lo demás se puede saltear: el paso muestra Omitir por ahora en texto --brand-text bajo el botón. Un formulario que exige el número de microchip para dar de alta un perro no lo completa nadie.
5.2 Paso 1 — Lo básico
Campo	Control	Validación
Foto	Avatar de 120px tocable con ícono de cámara superpuesto. Abre sheet con Sacar una foto, Elegir de la galería, Usar una ilustración y Quitar foto	Máximo 10 MB, recorte cuadrado obligatorio, se sube comprimida a 1080px
Nombre	Input de 52px, autocapitalize en palabras	Obligatorio. 2 a 30 caracteres. Sin emojis. Error: Poné un nombre de 2 a 30 letras.
Especie	3 chips grandes de 88px con ilustración: Perro, Gato, Otro	Obligatorio. Otro despliega un input ¿Qué animal es?
Raza	Input con autocompletado, lista filtrada por especie, con Mestizo y No la sé siempre arriba	Opcional. Si es Otro, campo libre
Sexo	2 chips: Macho, Hembra	Opcional
5.3 Paso 2 — Fechas y datos
Campo	Control	Validación
Fecha de nacimiento	Date picker nativo, con el atajo No la sé que la reemplaza por un selector de edad aproximada (Menos de 1 año / 1-2 / 3-5 / 6-8 / 9-12 / Más de 12)	No puede ser futura ni anterior a 30 años. Al elegirla, se muestra la edad calculada debajo: Tiene 3 años y 2 meses
Fecha de adopción o ingreso	Date picker, con atajo Desde que nació	No puede ser futura ni anterior a la de nacimiento. Error: La fecha de adopción no puede ser anterior a la de nacimiento. Al elegirla se muestra Hace 2 años que está con vos
Vínculo	3 chips: Es mía, Está en tránsito, La estoy cuidando	Opcional, default Es mía. Si es tránsito o cuidado, aparece Hasta cuándo (estimado) y Organización o responsable. Es el campo que conecta el alta con el archivado
Peso	Input numérico con sufijo kg, teclado decimal	0,1 a 120 kg. Un decimal
Tamaño	3 chips: Pequeño, Mediano, Grande	Se presugiere según la raza elegida, y el usuario lo puede cambiar
Color o pelaje	Input libre con sugerencias por especie	Máximo 40 caracteres
Señas particulares	Textarea de 3 líneas	Máximo 200 caracteres, con contador. Placeholder: Mancha blanca en el pecho, oreja izquierda caída…
5.4 Paso 3 — Salud
Campo	Control	Notas
¿Está castrado/a?	3 chips: Sí, No, No sé	
Número de microchip	Input numérico de 15 dígitos, con botón de escaneo por cámara	Validación de longitud. Error: El microchip tiene 15 números. Apoyo: Lo tenés en la libreta sanitaria.
Alergias y condiciones	Chips multiselección (Alergia alimentaria, Dermatitis, Epilepsia, Cardiopatía, Displasia, Diabetes) + campo libre Otra	
Medicación habitual	Lista editable: nombre, dosis, frecuencia	Se sincroniza con la Ficha Médica
Última vacuna	Selector de tipo + fecha	Alimenta los recordatorios. Apoyo: Después podés cargar el resto en la ficha médica.
Veterinaria de cabecera	Buscador contra el directorio de veterinarias	Opcional. Reutiliza el componente de búsqueda de la pantalla SOS

⚠️ Este paso entero es salteable y hay que decirlo arriba: Todo esto lo podés completar después desde la ficha médica.

5.5 Paso 4 — Perfil social

Alimenta Match y Comunidad.

Campo	Control
Personalidad	Chips multiselección, máximo 4: Juguetón, Tranquilo, Sociable, Tímido, Protector, Energético, Cariñoso, Independiente
Nivel de energía	Slider de 5 pasos, de Muy tranquilo a Muy activo
Se lleva bien con	3 toggles: Otros perros, Gatos, Chicos
Descripción	Textarea de 4 líneas, máximo 150 caracteres con contador. Placeholder: Contá algo de Titán: qué le gusta, cómo es con otros perros…
¿Aparece en Match?	Toggle, default encendido. Apoyo: Otras personas van a poder ver su perfil y proponer un encuentro.
¿Es tu mascota principal?	Toggle. Encendido y bloqueado si es la primera mascota. Apoyo: Es la que aparece en tu inicio.

Pantalla de confirmación al guardar: ilustración celebratoria, ¡Titán ya es parte de Zooni!, resumen en card con foto, nombre y raza, y dos botones: Completar su ficha médica (amarillo) y Listo (texto). Vuelve al índice con la card nueva resaltada por 1 segundo con un borde --brand-text que se desvanece.

5.6 Modo edición

Mismo formulario, presentado como una sola pantalla con secciones colapsables, no como wizard: editar es una tarea de búsqueda de un campo puntual, no un recorrido.

Header con ←, título Editar a Titán, y Guardar a la derecha en Bold 15px --brand-text, deshabilitado hasta que haya un cambio.
Cuatro secciones colapsables con los mismos títulos del wizard, todas colapsadas menos la primera.
Cambios sin guardar + intento de salir → ¿Descartar los cambios?.
Al pie, fuera de las secciones: Archivar a Titán y Eliminar a Titán.
Esta pantalla sí tiene botón Guardar explícito. Es la excepción a la regla de autoguardado de Configuración: son datos estructurados con validación cruzada entre campos (las fechas dependen entre sí), y guardar campo por campo dejaría estados inválidos intermedios.
6. Variantes de estado
#	Variante	Cuándo	Qué se muestra
V1	Base	Hay activas y archivadas	Lo descrito en 3.3
V2	Sin archivadas	Hay activas, ninguna archivada	Sección Archivadas (0) presente, con la card de estado vacío: fondo 
#FFFFFF al 60%, border-radius: 16px, alto 72px, texto centrado No hay mascotas archivadas. Regular 14px --text-soft. Literal del diseño actual, se mantiene
V3	Sin activas, con archivadas	Se archivó la última activa	Sección Activas (0) con texto centrado No tenés mascotas activas actualmente. Debajo, card de sugerencia: Recuperá una mascota archivada o agregá una nueva. Es el estado de la segunda captura, al que hoy le falta esa salida
V4	Vacío total	No hay ninguna mascota, de ningún tipo	Ilustración flat de perro y gato (~160px) centrada, título Todavía no cargaste ninguna mascota ExtraBold 18px --text, apoyo Agregá a tu compañero para usar la ficha médica, los paseos y el match. Regular 14px --text-soft centrado, y el CTA amarillo. Las secciones Activas y Archivadas no se muestran en este caso: dos encabezados vacíos hacen ver la pantalla rota
V5	Cargando	Fetch inicial	Título y CTA visibles y funcionales desde el primer frame. Una card skeleton por sección: rectángulo 
#EDF3EF de 240px con shimmer de 1.2s. Sin spinner de pantalla completa
V6	Sin conexión	No hay red	Banner 
#FEF3E0 bajo el título: Sin conexión. Estás viendo tus mascotas guardadas. en --amber-text. Las cards se muestran desde caché. Editar, Archivar, Recuperar y el CTA quedan deshabilitados al 45%; tocarlos muestra el toast Necesitás conexión para hacer este cambio.
V7	Error de guardado	Falló archivar, recuperar o eliminar	La card vuelve a su sección original con animación de 200ms y aparece el toast No pudimos archivar a Titán con acción Reintentar
V8	Límite alcanzado	Se llegó al máximo de mascotas activas	CTA deshabilitado + texto bajo el botón: Llegaste al máximo de 10 mascotas activas. Archivá alguna para agregar otra. en 13px --amber-text
V9	Home sin mascota	El usuario no tiene ninguna mascota activa	Es la tercera captura: header con ☰ y campana, y el texto No tenés mascota registrada aún 🐾 centrado sobre la ilustración de pasto. ⚠️ Tal como está, es un callejón sin salida: no hay ningún botón para agregar una. Hay que sumar, debajo del texto, el CTA amarillo Agregar mi mascota (pill 52px, 100% menos 40px por lado) que entra directo al wizard de alta, y un enlace secundario Ver mis mascotas archivadas en --brand-text Bold 14px cuando existan archivadas
7. RAMA B — BACKEND (Supabase)
7.1 Esquema de datos
pets
Columna	Tipo	Notas
id	uuid PK	default gen_random_uuid()
owner_id	uuid FK → auth.users NOT NULL	
name	text NOT NULL	CHECK (char_length(name) between 2 and 30)
species	text NOT NULL	dog | cat | other
species_other	text NULL	Solo si species = 'other'
breed	text NULL	
sex	text NULL	male | female
birth_date	date NULL	CHECK (birth_date <= current_date)
birth_date_is_estimate	bool	default false — marca la edad aproximada
adoption_date	date NULL	CHECK (adoption_date >= birth_date)
bond_type	text	own | fostering | caring, default 'own'
bond_until	date NULL	Fin estimado del tránsito
bond_org	text NULL	Organización o responsable
weight_kg	numeric(5,1) NULL	CHECK (weight_kg between 0.1 and 120)
size	text NULL	small | medium | large
color	text NULL	
distinguishing_marks	text NULL	Máx. 200
is_neutered	bool NULL	null = "no sé"
microchip	text NULL	CHECK (microchip ~ '^[0-9]{15}$'), único global
photo_url	text NULL	Supabase Storage
personality	text[]	default '{}', máx. 4
energy_level	int NULL	1 a 5
good_with	jsonb	{"dogs":true,"cats":false,"kids":true}
bio	text NULL	Máx. 150
visible_in_match	bool	default true
is_primary	bool	default false
status	text NOT NULL	active | archived | memorial | deleted, default 'active'
archived_at	timestamptz NULL	
archive_reason	text NULL	foster_ended | adopted | in_care | at_vet | no_longer_with_me | deceased | other
archive_reason_text	text NULL	
deceased_date	date NULL	Solo para memorial
deleted_at	timestamptz NULL	Inicio de los 30 días de gracia
purge_after	timestamptz NULL	deleted_at + interval '30 days'
created_at / updated_at	timestamptz	
sql
create index idx_pets_owner_status on pets (owner_id, status);
create unique index idx_pets_one_primary on pets (owner_id)
  where is_primary = true and status = 'active';
create unique index idx_pets_microchip on pets (microchip) where microchip is not null;
create index idx_pets_purge on pets (purge_after) where status = 'deleted';

status como columna única, no como pares de booleanos. Con is_archived + is_deleted sueltos existen estados imposibles (archivada y eliminada a la vez). Un enum los hace irrepresentables.

El índice único parcial idx_pets_one_primary garantiza a nivel de base que no puede haber dos mascotas principales. No se delega esa regla al cliente.

pet_photos

id, pet_id, url, is_cover, taken_at, created_at. Borrado en cascada.

pet_medical_records

Ficha médica ya existente. Se relaciona con on delete cascade pero nunca se borra al archivar. El archivado no toca esta tabla en absoluto — es el punto central del feature.

pet_status_history

Auditoría del ciclo de vida: id, pet_id, from_status, to_status, reason, changed_at, changed_by. Permite reconstruir el paso de una mascota por una casa de tránsito y devolver un dato útil a veterinarias.

7.2 Storage
Bucket pet-photos, privado. Acceso por URLs firmadas de 1 hora.
Ruta: {owner_id}/{pet_id}/{uuid}.webp. La ruta por owner_id permite una policy simple.
Subida: recorte cuadrado en el cliente, compresión a 1080×1080 WebP calidad 82, máximo 2 MB después de comprimir.
Al archivar no se borra ninguna foto. Al eliminar, las fotos se borran recién cuando vence el período de gracia, con el job de purga.
Thumbnail de 200px generado por Edge Function al subir, para las cards del índice.
7.3 Row Level Security

RLS activo. Regla base: auth.uid() = owner_id.

select: owner_id = auth.uid() and status <> 'deleted'. Las eliminadas en período de gracia no las ve el cliente; solo soporte con service_role.
insert: owner_id = auth.uid(), con trigger que valida el límite de mascotas activas.
update: owner_id = auth.uid(). Un trigger bloquea las transiciones de estado ilegales y no deja escribir status directamente — hay que pasar por las RPC.
delete físico deshabilitado para el cliente. Todo borrado es lógico.
Visibilidad pública para Match: una vista aparte public_pets expuesta solo con status = 'active' and visible_in_match = true, que devuelve únicamente nombre, foto, especie, raza, edad, personalidad y bio. Nunca microchip, peso, datos médicos ni fecha de adopción.
7.4 Funciones RPC
Función	Qué hace
create_pet(p_data jsonb)	Valida, inserta, sube a pet_status_history. Si es la primera mascota del usuario, la marca is_primary
update_pet(p_pet_id, p_patch jsonb)	Merge parcial. Rechaza cambios de status (esos van por las funciones de abajo). Valida las fechas cruzadas
archive_pet(p_pet_id, p_reason, p_reason_text)	active → archived (o → memorial si p_reason = 'deceased'). Setea archived_at. Si era principal, promueve a la activa más antigua y devuelve cuál en el resultado, para el toast. Cancela recordatorios pendientes. La saca del pool de Match. No toca ficha médica, fotos ni historial
unarchive_pet(p_pet_id)	archived → active. Valida el límite. Limpia archived_at y el motivo. Reactiva recordatorios recalculando vencimientos. No la vuelve principal
soft_delete_pet(p_pet_id)	Cualquier estado → deleted. Setea deleted_at y purge_after = now() + 30 días. Promueve otra principal si hacía falta
restore_deleted_pet(p_pet_id)	Solo service_role, para soporte. Revierte si purge_after > now()
set_primary_pet(p_pet_id)	Transacción: baja la anterior y sube la nueva. Solo sobre status = 'active'
purge_expired_pets()	Cron diario. Borra físicamente lo que tenga purge_after < now(), incluidas las fotos del Storage

Máquina de estados, validada por trigger. Cualquier otra transición se rechaza:

active ──archive──→ archived ──unarchive──→ active
active ──archive(deceased)──→ memorial
archived ──archive(deceased)──→ memorial
active | archived | memorial ──soft_delete──→ deleted
deleted ──restore (solo service_role, dentro de 30 días)──→ estado anterior
deleted ──purge (job, después de 30 días)──→ ✗ borrado físico
7.5 Efectos en cascada del archivado

Archivar dispara, en la misma transacción:

Sistema	Efecto
Home	Deja de mostrarse. Si no queda ninguna activa → estado vacío V9
Match	Sale del pool. Los matches existentes se conservan pero quedan en solo lectura
Paseos	No se pueden iniciar paseos nuevos. El historial se conserva completo
Recordatorios	Se cancelan los push de vacunas, desparasitación y turnos pendientes
Ficha médica	Sin cambios. Accesible en solo lectura
Chat Zooni	Deja de usarse como contexto del asistente
Fotos y Storage	Sin cambios
Mascota principal	Se promueve otra automáticamente

Recuperar revierte todo, salvo los recordatorios ya vencidos, que se recalculan en vez de dispararse retroactivamente. Recuperar una mascota archivada hace un año no debe generar 12 notificaciones de golpe.

7.6 Límites y reglas de negocio
Máximo 10 mascotas activas por usuario en cuentas personales. Sin límite de archivadas.
Cuentas de tipo veterinaria, refugio o casa de tránsito: límite configurable por service_role, default 100 activas. (El tipo de cuenta es material de otro prompt; acá solo se lee.)
Un microchip no puede repetirse entre usuarios. Al cargar uno ya existente: Ese número de microchip ya está registrado. Si es tu mascota, escribinos. — nunca se revela de quién es.
Máximo 30 fotos por mascota.
El nombre puede repetirse: dos perros pueden llamarse Titán.
7.7 Contratos que consume el frontend
Momento	Llamada	Bloquea UI
Al montar el índice	select de pets por owner_id, agrupado por status	No, muestra V5
Tocar Archivar	archive_pet(...)	No, optimista con rollback
Tocar Recuperar	unarchive_pet(...)	No, optimista con rollback
Guardar el alta	create_pet(...)	Sí, loader en el botón, timeout 15s
Guardar la edición	update_pet(...)	Sí, loader en Guardar
Subir foto	Storage + update_pet	Progreso en el avatar, cancelable
Confirmar eliminación	soft_delete_pet(...)	Sí, es irreversible desde la app
Marcar principal	set_primary_pet(...)	No, optimista
Cambio desde otro dispositivo	Realtime sobre pets filtrado por owner_id	No
7.8 Errores y contingencias
Caso	Comportamiento
archive_pet falla	V7: la card vuelve a Activas, toast con Reintentar
unarchive_pet con el límite lleno	Diálogo Llegaste al máximo de 10 mascotas activas. Archivá otra para recuperar a Titán.
Microchip duplicado	Error inline bajo el campo, sin revelar el propietario
Falla la subida de la foto	La mascota se crea igual con la ilustración por defecto + toast Guardamos a Titán, pero no pudimos subir la foto. Probá de nuevo desde Editar. La foto nunca bloquea el alta
Fecha de adopción anterior a la de nacimiento	Error inline, Continuar deshabilitado
Sin red durante el alta	El borrador se conserva localmente y se sincroniza al recuperar conexión; no se pierde nada de lo cargado
Se elimina la última mascota activa	Home pasa a V9, sin errores
Dos dispositivos archivan la misma mascota	La segunda llamada es idempotente: si ya está archived, devuelve OK sin fallar
Timeout en create_pet	Reintento automático con la misma clave de idempotencia, para no crear duplicados
8. Criterios de aceptación
Archivar una mascota no borra su ficha médica, sus fotos ni su historial de paseos. Verificable recuperándola y comprobando que todo sigue.
El botón Archivar no es rojo. El rojo está reservado para Eliminar.
Eliminar no aparece en la cara de la card: está en el menú ⋮ y en el detalle.
El CTA + Agregar nueva mascota tiene al menos 4.5:1 de contraste (amarillo con texto oscuro = 8.79:1, o 
#177046 con texto blanco = 6.10:1).
El botón Recuperar no usa verde claro con texto blanco: ese par da 1.78:1.
La línea bajo Activas y Archivadas usa 
#177046, no 
#2DBD72.
La card archivada no comunica su estado solo bajando la opacidad: tiene un chip con la palabra Archivada. 7b. El anillo del avatar archivado usa 
#7E9089 (3.10:1 sobre la card) y el texto del chip 
#4A5550 (6.33:1).
Con el filtro de escala de grises del sistema activado, se sigue distinguiendo una card activa de una archivada.
El toast de archivado tiene Deshacer y dura 6 segundos.
Archivar la mascota principal promueve otra automáticamente y lo informa en el toast.
Archivar la última mascota activa deja la Home en V9, con un botón para agregar una nueva.
La sección Archivadas se muestra aunque esté vacía, salvo en V4.
Con más de 8 archivadas aparece el buscador; con más de 10, la sección arranca colapsada.
Dar de alta una mascota solo exige nombre y especie. Todo lo demás se puede saltear.
Cargar una fecha de adopción anterior a la de nacimiento muestra error y bloquea Continuar.
Si falla la subida de la foto, la mascota se crea igual.
Eliminar exige escribir el nombre y tildar el checkbox, y ofrece archivar como alternativa antes de la confirmación.
El toast de eliminación no ofrece Deshacer.
No puede haber dos mascotas principales, ni siquiera forzando dos llamadas simultáneas (lo garantiza el índice único parcial).
Un usuario no puede leer ni modificar mascotas de otro (verificar con llamada directa a la API).
La vista pública de Match no expone microchip, peso ni datos médicos.
Salir del wizard a mitad de camino y volver ofrece retomar el borrador.
Con fuente del sistema al 200%, las cards crecen y ningún nombre se corta a mitad de palabra.
Archivar dos veces la misma mascota desde dos dispositivos no produce error.
9. Fuera de alcance de esta versión

Transferencia de una mascota a otro usuario (adopción dentro de la app, con traspaso de ficha médica); mascotas compartidas entre varios dueños; importación desde libretas sanitarias digitales; árbol genealógico; y el panel de cuentas de veterinaria o refugio, que es otra pantalla completa.

Anexo — Qué cambia respecto del diseño actual
Elemento	Hoy	Este prompt	Por qué
Ícono del header	☰ hamburguesa	Flecha ←	Es una sub-pantalla de segundo nivel; la hamburguesa no da forma de volver a Configuración
CTA Agregar	Blanco sobre 
#2DBD72 (2.43:1)	Amarillo --cta con texto oscuro (8.79:1)	Falla contraste, y el CTA primario de Zooni es amarillo
Botón Archivar	Rojo coral 
#F5626C, blanco (3.07:1)	Neutro 
#EDF3EF con borde y texto --brand-text	Comunica destrucción cuando la acción es reversible, y no pasa contraste. El rojo queda para Eliminar
Botón Recuperar	Verde claro con blanco (1.78:1)	
#177046 con blanco (6.10:1)	Prácticamente ilegible
Línea de sección	
#2DBD72 (2.15:1)	
#177046 (5.40:1)	No llega al 3:1 de elementos gráficos
Card archivada	Card blanca con opacidad reducida	Fondo opaco 
#F1F7F3 + chip Archivada + avatar desaturado	La opacidad arrastra el contraste de todo el contenido y desaparece con el filtro de grises
Toast	Fondo translúcido, sin acción	Fondo opaco + Deshacer + 6s	El contraste dependía de lo que quedara detrás, y no había forma de revertir
Eliminar	No existe	Menú ⋮ + pantalla dedicada con confirmación escrita y 30 días de gracia	Pedido explícito, y requisito de tienda
Emojis 🐾 y 📦	Emojis	Íconos vectoriales	No se tiñen, cambian entre plataformas, ensucian el lector de pantalla
Separador de raza	Perro - Labrador	Perro · Labrador	El punto medio es el separador del resto de la app
Metadatos en la card	No hay	3 años · 28 kg	Información útil sin entrar al detalle
Contador por sección	No hay	Activas (1)	Necesario apenas hay más de tres mascotas
Buscador en archivadas	No hay	A partir de 8 archivadas	Es el caso de uso de veterinarias y casas de tránsito
Motivo de archivado	No hay	Selector de 6 motivos	Hace utilizable una lista larga de archivadas
Estado En memoria	No hay	Tercera sección con tratamiento propio	Una mascota que falleció no es "archivada, motivo otro"
Home sin mascota	Texto solo, sin salida	Texto + CTA Agregar mi mascota	Hoy es un callejón sin salida
Estados de error y vacío	Solo 2	9 variantes	La pantalla no puede fallar en silencio