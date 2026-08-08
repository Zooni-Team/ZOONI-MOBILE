PROMPT — Pantalla Configuración (Zooni)

Destino: Claude Code / Cursor Backend: Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) Alcance: pantalla índice completa + las 11 sub-pantallas + 7 variantes de estado Versión: 1.0 Hermano: prompt-pantalla-sos.md — comparte la tabla de tokens y las reglas de accesibilidad

0. Cómo usar este prompt

Mismo formato que el prompt de SOS. Dos ramas:

Rama A — FRONTEND (secciones 2 y 3): estructura, estilo, contenido literal de cada fila y de cada sub-pantalla, estados e interacciones.
Rama B — BACKEND (sección 4): esquema de preferencias, seguridad, sincronización y acciones sensibles.

Reglas duras:

No inventar colores. Solo los tokens de 3.1. Los tokens --brand-text, --amber-text y --sos-red-text son obligatorios para texto; los --brand / --amber / --sos-red crudos no pasan contraste como tipografía (ver 3.8).
No inventar copys. Todos los labels literales están en la sección 3.5. Si falta uno, pedirlo.
Toda preferencia se guarda sola. No hay botón "Guardar" en ninguna sub-pantalla salvo donde se indique explícitamente (cambio de email, cambio de contraseña, eliminar cuenta).
Optimista + rollback. El control refleja el cambio al instante; si el backend falla, vuelve al valor anterior y aparece un toast de error. Nunca un spinner bloqueando un switch.
Mobile-first, 390px de referencia. Correcto entre 320px y 430px.
Lo no especificado acá lo resuelven las Instrucciones Generales de Diseño de Zooni.
1. Contexto de la pantalla

Qué es: el índice de configuración de Zooni. No es una pantalla de tareas, es una pantalla de navegación: su único trabajo es que el usuario encuentre rápido la opción que busca entre 11 destinos y entre a la sub-pantalla correcta.

Consecuencias de diseño:

La densidad importa más que la decoración. 11 filas tienen que ser escaneables de un vistazo, agrupadas por afinidad.
Cada fila es un destino, nunca un control. En el índice no hay switches, ni sliders, ni selectores: todo eso vive adentro de las sub-pantallas. Un switch suelto en un índice hace que el usuario toque la fila esperando entrar y termine cambiando una preferencia sin querer.
La única excepción a lo anterior son las acciones destructivas del pie (Cerrar sesión, Eliminar cuenta), que van visualmente separadas y fuera de los grupos.
Es una pantalla de baja urgencia y alta confianza: acá el usuario toca datos personales, privacidad y pagos. El tono tiene que ser claro y sin ambigüedad, sobre todo en lo destructivo.

Tono de voz: claro y directo. Tuteo. Sin emojis en los labels de las filas (los emojis van reemplazados por íconos vectoriales, ver 3.4). Los textos de apoyo explican la consecuencia, no la mecánica: Nadie va a poder ver tu ubicación en el mapa en vez de Desactiva el flag de geolocalización.

2. Punto de entrada y navegación
2.1 Cómo se llega

⚠️ Asunción a confirmar: la pantalla se abre desde el drawer lateral que despliega el ícono de hamburguesa ☰ presente en el header de todas las pantallas de Zooni, en el último ítem de la lista, con el label Configuración. Si el acceso real es otro (por ejemplo un engranaje dentro de Perfil de Usuario), cambiar solo esta sub-sección; el resto del prompt no se toca.

Puntos de entrada secundarios recomendados:

Desde Perfil de Usuario, ícono de engranaje 22px arriba a la derecha → abre esta pantalla.
Deep links directos a sub-pantallas: zooni://settings/notifications, zooni://settings/privacy, etc. Los necesitan las notificaciones push del tipo "revisá tus permisos".
2.2 Transición
Navegación push, slide desde la derecha, 250ms ease-out.
Al abrirse desde el drawer, el drawer se cierra primero (200ms) y recién después empuja la pantalla. Nunca las dos animaciones en simultáneo.
Las sub-pantallas también entran con push. La jerarquía es de 2 niveles: Configuración → sub-pantalla. Una tercera (por ejemplo Cuenta y Seguridad → Sesiones activas) está permitida pero es el máximo.
2.3 Cómo se sale
Swipe-back nativo (iOS) y botón físico atrás (Android) → vuelven a la pantalla anterior.
El ícono ☰ del header de Configuración vuelve a abrir el drawer, no funciona como "atrás". En las sub-pantallas, en cambio, ese lugar lo ocupa una flecha atrás ←.
Sin bottom tab bar. Configuración se abre como una pila fuera de la navegación por tabs. Esto es coherente con el screenshot, donde la barra no aparece.
Si hay cambios sin confirmar en un formulario (cambio de email, contraseña), salir dispara un diálogo ¿Descartar los cambios? con botones Descartar y Seguir editando. En el resto de las sub-pantallas no hace falta: todo se guarda solo.
RAMA A — FRONTEND
3.1 Tokens de estilo

Se hereda la tabla completa del prompt de SOS. Tokens que esta pantalla usa, más los que agrega:

Token	Hex	Uso en esta pantalla
--bg-main	
#C8F0D8	Fondo de la pantalla
--bg-main-soft	
#D9F6E4	Extremo superior del degradado de fondo
--surface	
#FFFFFF	Fondo de los grupos de filas
--text	
#2C2C2C	Título de pantalla y label de cada fila
--text-soft	
#6B6B6B	Valor secundario y textos de apoyo sobre blanco
--text-soft-mint	
#5A6B60	Token nuevo. Labels de grupo y textos de apoyo sobre el fondo menta (
#6B6B6B sobre menta da 4.29:1 y no llega)
--chevron	
#8A8A8A	Token nuevo. Flecha › de cada fila (el 
#AAAAAA del diseño actual da 2.32:1 y no llega al 3:1 de elementos gráficos)
--divider	
#E8EFE9	Línea entre filas dentro de un grupo
--brand	
#2DBD72	Solo rellenos decorativos
--brand-text	
#177046	Texto e íconos verdes, relleno del switch encendido
--amber-text	
#A05F00	Texto de advertencia (permiso denegado, pago vencido)
--sos-red-text	
#B3121D	Cerrar sesión, Eliminar cuenta, estados de error
--sos-red-tint	
#FDECEE	Fondo del bloque destructivo
--cta	
#F5C842	Botones primarios dentro de sub-pantallas, siempre con texto --text
--switch-off	
#D8DEDA	Token nuevo. Riel del switch apagado

Tintes de ícono (fondo del cuadrado que contiene cada ícono de fila). Cada uno es un pastel del 12% sobre blanco, todos con el glifo a --text o al color pleno correspondiente:

Grupo temático	Tinte	Glifo
Cuenta / identidad	
#E8EEFB	
#3A5CA8
Apariencia	
#FDEAF2	
#A83A6B
Medios	
#EAF1F7	
#2F6B8F
Tiempo / bienestar	
#F1EDFB	
#5A3AA8
Mascotas	
#E8F7EE	
#177046
Privacidad / seguridad	
#FEF3E0	
#8A5A00
Permisos	
#EDEBFA	
#4A3AA0
Notificaciones	
#FEF6DC	
#8A6A00
Pagos	
#E6F4FB	
#1A6A8F
Legal	
#EFF1F3	
#4A5560
Ayuda	
#FDECEE	
#B3121D
Tipografía

Familia Nunito (fallback Poppins).

Rol	Peso	Tamaño	Interlineado
Título de pantalla (Configuración)	ExtraBold (800)	28px	34px
Título de sub-pantalla (en su header)	ExtraBold (800)	20px	26px
Label de grupo	Bold (700)	13px	18px
Label de fila	SemiBold (600)	16px	22px
Valor secundario de fila	Regular (400)	14px	19px
Texto de apoyo bajo un control	Regular (400)	13px	18px
Texto de acción destructiva	Bold (700)	16px	22px
Versión de la app	Regular (400)	12px	16px
Espaciado, radios y sombras
Margen horizontal de pantalla: 16px a cada lado (más angosto que en SOS: acá las cards son listas y necesitan ancho útil).
Radio de los grupos: 18px. Radio de los cuadrados de ícono: 10px.
Alto de fila: 56px fijo cuando solo hay label; 68px cuando la fila lleva valor secundario en segunda línea.
Padding horizontal interno de fila: 16px.
Separación entre grupos: 16px. Entre el título de grupo y su card: 8px.
Sombra de grupo: 0 4px 8px rgba(0,0,0,0.12) — la sombra estándar de card de Zooni. Sin borde.
El divisor entre filas no llega a los bordes: arranca a 60px del borde izquierdo (alineado con el label, después del ícono) y termina a 0px del derecho. Última fila de cada grupo: sin divisor.
3.2 Anatomía de la pantalla
┌─────────────────────────────────────────┐
│ [safe area]                             │
│ ☰                                       │  ← A. Header
│                                         │
│         Configuración  ⚙                │  ← B. Título grande
│                                         │
│  CUENTA                                 │  ← C. Label de grupo
│  ┌───────────────────────────────────┐  │
│  │ [👤] Cuenta y Seguridad         › │  │  ← D. Fila
│  │ ───────────────────────────────── │  │
│  │ [🎨] Tema de la aplicación      › │  │
│  │ ───────────────────────────────── │  │
│  │ [🎬] Medios y Calidad           › │  │
│  │ ───────────────────────────────── │  │
│  │ [⏱] Tiempo en la app            › │  │
│  └───────────────────────────────────┘  │
│                                         │
│  MASCOTAS Y PRIVACIDAD                  │
│  ┌───────────────────────────────────┐  │
│  │ [🐾] Mis Mascotas               › │  │
│  │ [🔒] Privacidad y visibilidad   › │  │
│  │ [📱] Permisos de la app         › │  │
│  │ [🔔] Notificaciones y alertas   › │  │
│  └───────────────────────────────────┘  │
│                                         │
│  APP Y SOPORTE                          │
│  ┌───────────────────────────────────┐  │
│  │ [💳] Suscripciones y pagos      › │  │
│  │ [📄] Legal y Términos           › │  │
│  │ [❓] Ayuda y Soporte             › │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │        Cerrar sesión              │  │  ← E. Bloque destructivo
│  └───────────────────────────────────┘  │
│         Eliminar mi cuenta              │
│                                         │
│         Zooni 1.4.2 (build 218)         │  ← F. Pie
└─────────────────────────────────────────┘

Fondo: degradado vertical muy suave de --bg-main-soft 
#D9F6E4 (arriba) a --bg-main 
#C8F0D8 (abajo). Sobre él, la ilustración decorativa de hojas que se ve en el diseño actual: silueta de hoja/planta en verde 
#A8DFC0 al 55% de opacidad, anclada al borde derecho a la altura del segundo grupo, aproximadamente 120px de ancho, con overflow recortado por el borde de la pantalla. Es puramente decorativa: va marcada como oculta para el lector de pantalla y nunca queda por encima de una card.

Scroll: toda la pantalla scrollea, incluido el título. No hay header sticky. Al scrollear más de 40px, aparece con fade (150ms) una barra superior compacta de 52px con fondo --bg-main al 92% + blur, el ícono ☰ a la izquierda y el texto Configuración en Bold 17px --text centrado, para que el usuario no pierda referencia.

3.3 Componentes
A. Header
Alto: 52px + safe area. Fondo transparente (deja ver el degradado).
Izquierda: ícono hamburguesa ☰, 26×26px, trazo 2.5px, extremos redondeados, color --text 
#2C2C2C. Área táctil 44×44px, a 16px del borde. Acción: abre el drawer lateral.
Sin campana de notificación en esta pantalla: acá no hay nada que notificar y el ícono compite con el título. (Es una diferencia deliberada respecto del header estándar de Zooni.)
Sin borde inferior ni sombra.
B. Título de pantalla
Texto Configuración — Nunito ExtraBold 28px, --text, centrado, con 24px de margen superior respecto del header y 24px inferior.
A la derecha del texto, separado 10px y alineado a la base óptica: ícono de engranaje de 24px en --text-soft. Reemplazar el emoji ⚙️ por un ícono vectorial — el emoji renderiza distinto en iOS y Android y desalinea la línea de base.
Si el idioma alarga el string y no entra en una línea, el título baja a 24px antes de partirse en dos líneas.
C. Label de grupo
Texto en Nunito Bold 13px, --text-soft-mint 
#5A6B60, alineado a la izquierda, a 16px del borde y 4px adicionales de sangría respecto de la card (total 20px).
En minúscula con inicial mayúscula, no en mayúsculas completas — las instrucciones de Zooni prohíben las mayúsculas completas salvo la sigla "S.O.S". Copys literales: Cuenta, Mascotas y privacidad, App y soporte.
⚠️ Estos labels no existen en el diseño actual (los tres grupos aparecen sin título). Se agregan porque 11 filas sin encabezados obligan a leer todo el índice para encontrar una opción. Si se decide no incorporarlos, la separación de 16px entre grupos es suficiente para que el agrupamiento se lea, pero se pierde la escaneabilidad.
D. Fila de navegación (SettingsRow)

El componente que se repite 11 veces. Estructura horizontal, alto 56px, padding 16px:

Ícono: cuadrado de 32×32px, border-radius: 10px, fondo = tinte del grupo temático (tabla en 3.1), glifo vectorial de 18px centrado en el color pleno correspondiente. Sin emojis.
Gap: 12px.
Label: Nunito SemiBold 16px --text. Una línea, ellipsis si no entra. Ocupa el espacio flexible.
Valor secundario (opcional): alineado a la derecha, antes del chevron, Regular 14px --text-soft. Se usa para adelantar estado sin entrar: Claro en Tema, 3 mascotas en Mis Mascotas, Plan Free en Suscripciones. Si el label y el valor no entran juntos, el valor cae a una segunda línea bajo el label y la fila crece a 68px.
Chevron: › de 16px, trazo 2px, color --chevron 
#8A8A8A, a 16px del borde derecho.
Badge de atención (opcional): punto de 8px en --amber-text a la izquierda del chevron cuando esa sección requiere acción del usuario (un permiso denegado, un pago rechazado, el email sin verificar). Siempre acompañado de texto en la sub-pantalla — el color solo nunca comunica.

Estados:

:pressed → fondo de la fila 
#F2F7F4, sin scale (escalar una fila dentro de una card se ve roto), 100ms.
:disabled → label y ícono al 45% de opacidad, chevron oculto, sin respuesta al toque.
Área táctil = toda la fila, de borde a borde de la card. Alto mínimo real 48px ya cumplido con los 56px.

Accesibilidad: cada fila es un único nodo con accessibilityRole="button", label = "<label de la fila>, botón", y hint = "Abre <label>". El chevron y el ícono se marcan como decorativos.

E. Bloque destructivo

Separado de los tres grupos por 24px, no lleva label de grupo.

Cerrar sesión: card blanca de una sola fila, mismo radio y sombra que los grupos, alto 56px, texto centrado (sin ícono, sin chevron) en Nunito Bold 16px --sos-red-text 
#B3121D.
Acción: abre un diálogo ¿Cerrar sesión? / Vas a tener que volver a iniciar sesión para usar Zooni. con botones Cerrar sesión (rojo) y Cancelar (texto --text-soft).
Eliminar mi cuenta: fuera de la card, como texto suelto centrado sobre el fondo menta, Regular 14px --text-soft-mint, subrayado. Margen superior 16px.
Deliberadamente tiene menos peso visual que Cerrar sesión: es la acción más destructiva de la app y no debe invitar al toque.
Acción: navega a una sub-pantalla de confirmación, nunca a un diálogo simple. Ver 3.5.11.
F. Pie
Texto centrado Zooni 1.4.2 (build 218) — Regular 12px --text-soft-mint. Margen superior 24px, inferior 32px + safe area.
Toque largo sobre la versión: copia al portapapeles el string completo con device, OS y user_id para soporte, y muestra el toast Datos de diagnóstico copiados. Es un truco de soporte, no está documentado en la UI.
3.4 Inventario literal del índice

Los 11 destinos, en el orden exacto del diseño actual. Este orden no se cambia.

#	Grupo	Label literal	Ícono	Valor secundario	Destino
1	Cuenta	Cuenta y Seguridad	Persona	email del usuario, truncado	3.5.1
2	Cuenta	Tema de la aplicación	Paleta	Claro / Oscuro / Automático	3.5.2
3	Cuenta	Medios y Calidad	Claqueta / imagen	Alta / Media / Baja	3.5.3
4	Cuenta	Tiempo en la app	Reloj	1 h 12 min hoy	3.5.4
5	Mascotas y privacidad	Mis Mascotas	Huella	3 mascotas	3.5.5
6	Mascotas y privacidad	Privacidad y visibilidad	Candado	Perfil público / Perfil privado	3.5.6
7	Mascotas y privacidad	Permisos de la app	Teléfono	2 pendientes si hay denegados	3.5.7
8	Mascotas y privacidad	Notificaciones y alertas	Campana	Activadas / Silenciadas	3.5.8
9	App y soporte	Suscripciones y pagos	Tarjeta	Plan Free / Zooni Plus	3.5.9
10	App y soporte	Legal y Términos	Documento	—	3.5.10
11	App y soporte	Ayuda y Soporte	Signo de pregunta	—	3.5.11

Nota sobre los emojis: el diseño actual usa emoji (👤 🎨 📻 ⏱ 🐾 🔒 📱 🔔 💎 📄 ❓). Se reemplazan uno a uno por íconos vectoriales del mismo set (Lucide, Phosphor o el que ya use Zooni), respetando la metáfora de cada uno. Motivos: los emojis cambian de forma y color entre iOS, Android y versiones del sistema; no se pueden teñir; no escalan con el tamaño de fuente accesible; y el lector de pantalla los lee en voz alta ("emoji de campana") ensuciando la navegación.

3.5 Contenido completo de cada sub-pantalla

Todas comparten el mismo chasis: header de 52px con flecha ← a la izquierda, título de la sección en ExtraBold 20px --text centrado, fondo --bg-main, contenido en cards blancas agrupadas con el mismo radio de 18px, y los mismos componentes de fila.

Controles disponibles (usar solo estos):

SettingsRow — navega a otro lado (ya especificado en 3.3.D).
SettingsToggle — label + texto de apoyo opcional + switch a la derecha. Switch: riel 50×30px border-radius: 15px, apagado --switch-off 
#D8DEDA, encendido --brand-text 
#177046 (el 
#2DBD72 con el knob blanco da 2.43:1 y no distingue estados para baja visión), knob blanco de 26px con sombra 0 1px 3px rgba(0,0,0,0.2), transición 180ms. Toda la fila es tocable, no solo el switch.
SettingsSelect — label + valor actual a la derecha + chevron; abre un bottom sheet con las opciones como radio list, check --brand-text de 20px en la seleccionada, y se cierra al elegir.
SettingsSlider — label, valor actual a la derecha, riel de 4px --switch-off con relleno --brand-text, knob de 24px. Con marcas discretas cuando los valores son escalonados.
SettingsAction — fila con label centrado o alineado a izquierda que dispara una acción (destructiva en --sos-red-text, neutra en --brand-text).
SettingsInfo — label + valor de solo lectura, sin chevron, sin interacción.
3.5.1 Cuenta y Seguridad

Grupo "Tu perfil"

Fila de cabecera especial de 88px: avatar circular de 64px con borde de 2px --brand, a la derecha el nombre en Bold 17px y el @usuario en Regular 14px --text-soft, chevron. Navega a editar perfil.
Nombre y apellido — SettingsRow, valor = nombre actual.
Nombre de usuario — SettingsRow, valor = @nacho. Validación de unicidad al guardar.
Foto de perfil — SettingsAction, abre selector cámara / galería / eliminar.
Biografía — SettingsRow, máximo 150 caracteres, contador visible al editar.

Grupo "Datos de acceso"

Correo electrónico — SettingsRow, valor = email. Si no está verificado, badge ámbar y texto de apoyo Sin verificar. Tocá para reenviar el correo. Cambiar el email requiere contraseña actual y verificación del email nuevo antes de aplicarse.
Teléfono — SettingsRow, con verificación por SMS.
Cambiar contraseña — SettingsRow → formulario con Contraseña actual, Nueva contraseña, Repetir nueva contraseña, medidor de fuerza (débil / media / fuerte, en --sos-red-text / --amber-text / --brand-text), mínimo 8 caracteres, botón Guardar amarillo deshabilitado hasta que sea válido. Esta es una de las tres pantallas con botón Guardar explícito.
Cuentas vinculadas — SettingsRow → lista con Google y Apple, cada una con estado Vinculada / Vincular. No se puede desvincular la última si no hay contraseña definida.

Grupo "Seguridad"

Verificación en dos pasos — SettingsToggle. Apoyo: Pedimos un código además de tu contraseña cuando inicies sesión en un dispositivo nuevo.
Sesiones activas — SettingsRow, valor = 4 dispositivos → lista con modelo, ubicación aproximada, última actividad, y Cerrar sesión por cada una. La sesión actual se marca Este dispositivo y no se puede cerrar desde acá.
Cerrar sesión en todos los dispositivos — SettingsAction destructiva, con diálogo de confirmación.
3.5.2 Tema de la aplicación
Apariencia — SettingsSelect con Claro / Oscuro / Automático (según el sistema). Aplicación inmediata, sin reinicio de la app, con crossfade de 200ms.
Vista previa en vivo: card de 140px arriba de todo que muestra una mini-maqueta de la Home de Zooni con el tema elegido. Se actualiza al instante.
Tamaño del texto — SettingsSlider de 5 pasos: Chico / Normal / Grande / Muy grande / Máximo. Debajo, una línea de texto de ejemplo que cambia de tamaño en tiempo real. Este control se suma al del sistema operativo, no lo reemplaza; si el usuario ya subió la fuente en el SO, se muestra el aviso Ya tenés un tamaño grande configurado en tu teléfono.
Reducir movimiento — SettingsToggle. Apoyo: Desactiva las animaciones de transición. Viene encendido por defecto si el SO lo tiene activado.
Alto contraste — SettingsToggle. Apoyo: Aumenta el contraste de textos y bordes.
Íconos de la app — SettingsRow (opcional, solo si hay más de un ícono) → grilla de variantes.

⚠️ Modo oscuro: si todavía no está implementado, la opción Oscuro se muestra deshabilitada con el texto de apoyo Próximamente. No se oculta: ocultarla genera más consultas a soporte que mostrarla apagada.

3.5.3 Medios y Calidad

Grupo "Calidad"

Calidad de subida de fotos — SettingsSelect: Alta / Media / Baja (ahorra datos). Apoyo con el peso aproximado de cada opción.
Calidad de descarga — SettingsSelect: Automática / Alta / Ahorro de datos.
Calidad del video en paseos en vivo — SettingsSelect: Automática / Alta (720p) / Baja (480p). Apoyo: La calidad baja usa menos batería y datos durante el seguimiento del paseo.

Grupo "Reproducción"

Reproducir videos automáticamente — SettingsSelect: Siempre / Solo con Wi-Fi / Nunca. Default Solo con Wi-Fi.
Silenciar videos al abrirlos — SettingsToggle, default encendido.

Grupo "Datos y almacenamiento"

Descargar contenido solo con Wi-Fi — SettingsToggle.
Precargar imágenes del feed — SettingsToggle. Apoyo: Carga más rápido pero consume más datos.
Guardar las fotos que saco en Zooni — SettingsToggle, guarda copia en el rollo del teléfono.
Espacio usado — SettingsInfo, valor 248 MB desglosado en Imágenes 180 MB · Videos 52 MB · Otros 16 MB.
Vaciar caché — SettingsAction en --brand-text, valor = tamaño actual. Diálogo ¿Vaciar la caché? / Se van a borrar las imágenes guardadas temporalmente. No perdés nada de tu cuenta. Al terminar, toast Liberamos 248 MB y el valor pasa a 0 MB.
3.5.4 Tiempo en la app

Pantalla de bienestar digital. No es una pantalla de configuración pura: la mitad de arriba es informativa.

Gráfico de barras semanal: 7 barras (L a D), alto máximo 120px, barras en --brand con la de hoy en --brand-text, border-radius: 6px arriba. Eje inferior con las iniciales del día en Regular 11px --text-soft. Al tocar una barra, aparece el valor exacto arriba.
Hoy / Promedio diario / Esta semana — tres SettingsInfo en fila, con el valor en Bold 18px --text y el label en Regular 12px --text-soft.
Desglose por sección — SettingsRow → lista con Comunidad, Chat, Match, Mapa, Servicios, cada una con su tiempo y una barra de proporción.

Grupo "Límites"

Límite de uso diario — SettingsToggle + al activarse aparece un SettingsSelect con 30 min / 1 h / 1 h 30 min / 2 h / Personalizado. Apoyo: Te avisamos cuando llegues al límite. No bloqueamos la app.
Recordatorio de descanso — SettingsSelect: Nunca / Cada 30 min / Cada hora.
Resumen semanal — SettingsToggle. Apoyo: Recibí cada lunes un resumen de tu uso.
Horario sin notificaciones — SettingsRow → dos selectores de hora (desde / hasta) y días de la semana. Comparte estado con 3.5.8.

⚠️ Regla de tono: nunca culpabilizar. Los copys son descriptivos (Usaste Zooni 1 h 12 min hoy), jamás evaluativos (Usaste demasiado). Y el límite avisa, no bloquea: bloquear el acceso podría dejar a alguien sin poder llegar a la pantalla de SOS.

3.5.5 Mis Mascotas
Lista de mascotas. Cada una es una card de 80px: avatar circular 56px con borde 2px --brand, nombre en Bold 16px, debajo Perro · Golden Retriever · 3 años en Regular 13px --text-soft, chevron. Si es la mascota activa, chip Principal en --brand-text sobre 
#E8F7EE.
Toque en una mascota → Detalle de mascota con: foto, nombre, especie, raza, sexo, fecha de nacimiento, peso, castrado (sí/no), microchip, color, señas particulares, Ficha médica (navega a la pantalla existente), Marcar como principal, Editar y Eliminar mascota.
Agregar mascota — SettingsAction en --brand-text con ícono +, o botón pill amarillo al pie si la lista está vacía.
Reordenar: toque largo sobre una card habilita el arrastre. El orden define cuál aparece primero en Home y en Match.
Eliminar mascota — destructiva, diálogo ¿Eliminar a Titán? / Se borra su ficha médica, sus fotos y su historial de paseos. No se puede deshacer. con confirmación por texto solo si la mascota tiene ficha médica cargada.
Estado vacío: ilustración flat de un perro (~140px), título Todavía no cargaste ninguna mascota, apoyo Agregá a tu compañero para usar el match, la ficha médica y los paseos. y botón amarillo Agregar mi primera mascota.
3.5.6 Privacidad y visibilidad

Grupo "Tu perfil"

Perfil privado — SettingsToggle. Apoyo: Solo tus amigos pueden ver tus publicaciones y tus mascotas.
Mostrar mi edad — SettingsToggle.
Mostrar mi zona — SettingsSelect: Barrio / Ciudad / No mostrar. Apoyo: Nunca mostramos tu dirección exacta.

Grupo "Ubicación"

Compartir mi ubicación en el mapa — SettingsSelect: Todos / Solo mis amigos / Nadie. Es la preferencia más sensible de la app; el texto de apoyo cambia según la opción y explica exactamente quién ve qué.
Precisión de mi ubicación — SettingsSelect: Exacta / Aproximada (radio de 500 m). Default Aproximada.
Ubicación en vivo durante los paseos — SettingsToggle. Apoyo: Mientras dure el paseo, las personas que elijas pueden seguirte en tiempo real.

Grupo "Quién puede…"

Enviarme solicitudes de amistad — SettingsSelect: Todos / Amigos de amigos / Nadie.
Escribirme por chat — SettingsSelect: Todos / Solo mis amigos / Solo con los que hice match.
Ver mis mascotas en Match — SettingsToggle. Apagarlo saca al usuario del pool de match, y hay que decirlo en el apoyo: Si lo desactivás, tus mascotas dejan de aparecerle a otras personas.

Grupo "Bloqueos y actividad"

Usuarios bloqueados — SettingsRow, valor = cantidad → lista con avatar, nombre y Desbloquear.
Cuentas silenciadas — SettingsRow.
Mostrar cuándo estoy en línea — SettingsToggle. Apoyo: Si lo desactivás, tampoco vas a ver cuándo están en línea los demás.
Confirmaciones de lectura — SettingsToggle, con la misma reciprocidad.
3.5.7 Permisos de la app

Esta pantalla no cambia permisos por sí sola: los permisos los otorga el sistema operativo. Cada fila muestra el estado real leído del SO y ofrece el atajo para ir a los ajustes.

Cada fila: ícono + nombre del permiso + estado a la derecha en Regular 14px, con el color según el caso:

Permitido → --brand-text
Solo mientras uso la app → --brand-text
Denegado → --sos-red-text
Sin definir → --text-soft

Permisos a listar, cada uno con su apoyo explicando para qué lo usa Zooni:

Permiso	Para qué
Ubicación	Para mostrarte veterinarias cerca, el mapa de amigos y el seguimiento de paseos.
Cámara	Para sacarle fotos a tus mascotas y escanear códigos QR.
Fotos y galería	Para elegir la foto de perfil y subir fotos de tus mascotas.
Micrófono	Para mandar mensajes de voz en el chat.
Notificaciones	Para avisarte de mensajes, solicitudes y recordatorios de vacunas.
Contactos	Para ayudarte a encontrar amigos que ya usan Zooni.
Actividad física	Para contar los pasos y la distancia de los paseos.
Bluetooth	Para conectarte con collares con GPS.
Cada fila, al tocarse, abre los ajustes del sistema de la app (Linking.openSettings()). Nunca se intenta re-pedir un permiso ya denegado desde el prompt nativo: en iOS el segundo pedido no muestra nada y el usuario queda atascado.
Al volver del sistema, la pantalla revalida todos los permisos (listener de AppState en active) y refresca los estados sin necesidad de recargar.
Arriba de la lista, si hay permisos denegados que bloquean funciones clave, banner 
#FEF3E0 con texto --amber-text: Sin ubicación no podemos mostrarte veterinarias cerca ni el mapa de amigos.
3.5.8 Notificaciones y alertas

Grupo maestro

Notificaciones push — SettingsToggle maestro. Si el permiso del sistema está denegado, el switch se muestra apagado y deshabilitado, con el apoyo Están desactivadas desde los ajustes de tu teléfono. y un SettingsAction Abrir ajustes.
Apagar el maestro colapsa (con animación de 200ms) todos los grupos siguientes en vez de deshabilitarlos fila por fila.

Grupo "Actividad" — cada uno un SettingsToggle:

Mensajes nuevos
Solicitudes de amistad
Match nuevo
Me gusta y comentarios
Alguien empezó a seguirte

Grupo "Mascotas y servicios"

Paseo en vivo — apoyo: Avisos de inicio, fin y desvíos de ruta.
Recordatorios de vacunas y desparasitación
Turnos de veterinaria
Novedades de veterinarias y pet shops que sigo

Grupo "Comunidad"

Alertas de mascotas perdidas cerca tuyo — apoyo: Te avisamos si alguien publica una mascota perdida en un radio de 3 km.
Carteles nuevos en el mapa

Grupo "Zooni"

Novedades y consejos
Promociones y descuentos — apagado por defecto. Todo lo comercial es opt-in.

Grupo "Cómo te avisamos"

Sonido — SettingsToggle.
Vibración — SettingsToggle.
Mostrar la vista previa en la pantalla bloqueada — SettingsSelect: Siempre / Solo cuando está desbloqueado / Nunca.
Correo electrónico — SettingsToggle para el resumen por mail.
No molestar — SettingsToggle + al activarse, dos selectores de hora (Desde 22:00 / Hasta 08:00) y selector de días. Apoyo: Las alertas de mascota perdida siguen llegando.

⚠️ Excepción no configurable: las notificaciones críticas de seguridad de la cuenta (inicio de sesión en un dispositivo nuevo, cambio de contraseña) no se pueden desactivar. Se listan como SettingsInfo con el valor Siempre activas y el apoyo Por tu seguridad, estas no se pueden desactivar.

3.5.9 Suscripciones y pagos

Card de plan actual (destacada, 120px, fondo blanco con borde 2px --cta):

Nombre del plan en ExtraBold 20px, estado (Activo / Vence el 12/09 / Cancelado, activo hasta el 12/09), y lista de 3 beneficios con check --brand-text.
Si es plan Free: botón amarillo Conocer Zooni Plus.
Si es Plus: Administrar suscripción, que abre la gestión de la tienda (App Store / Google Play), porque la baja de una suscripción in-app se hace ahí y no en el servidor.

Grupo "Pagos"

Métodos de pago — SettingsRow, valor = •••• 4242 → lista, agregar, eliminar, marcar predeterminado.
Historial de facturación — SettingsRow → lista de cargos con fecha, concepto, monto, estado y Descargar comprobante.
Restaurar compras — SettingsAction en --brand-text. Obligatorio en iOS.
Códigos y cupones — SettingsRow → input para canjear.

Grupo "Servicios"

Pagos a veterinarias y paseadores — SettingsRow → historial de pagos hechos dentro de la app.
Facturación — datos fiscales para comprobantes.

Estados a cubrir: pago rechazado (banner rojo con Actualizá tu método de pago), suscripción en período de gracia, suscripción cancelada pero vigente, y compra pendiente de confirmación de la tienda.

3.5.10 Legal y Términos

Todas filas de navegación simples que abren contenido en un WebView interno (con header propio y botón de compartir), no en el navegador externo:

Términos y condiciones
Política de privacidad
Política de cookies
Normas de la comunidad
Licencias de código abierto — pantalla nativa, generada automáticamente desde las dependencias.

Grupo "Tus datos"

Descargar mis datos — SettingsAction. Genera un export y lo manda por email. Apoyo: Te enviamos un archivo con toda tu información a <email>. Puede tardar hasta 48 horas. Después de pedirlo, la fila muestra Solicitado el 03/08 y queda deshabilitada 48 horas.
Eliminar mi cuenta — SettingsAction destructiva, mismo destino que el del índice (3.5.11 abajo).

Grupo "Sobre la app"

Versión — SettingsInfo, 1.4.2 (218).
Novedades de esta versión — SettingsRow → changelog.
3.5.11 Ayuda y Soporte
Centro de ayuda — SettingsRow → FAQ con buscador y categorías.
Contactar a soporte — SettingsRow → formulario con asunto, descripción, adjuntar captura, y adjunta automáticamente versión, modelo, SO y user_id. Avisarlo en el formulario: Adjuntamos datos de tu dispositivo para poder ayudarte más rápido.
Reportar un problema — SettingsRow, con selector de categoría.
Reportar un usuario o contenido — SettingsRow.
Sugerir una mejora — SettingsRow.
Estado del servicio — SettingsRow, con un punto de color: --brand-text Todo funcionando / --amber-text Problemas parciales / --sos-red-text Caído.
Calificar Zooni — SettingsAction, abre el review nativo de la tienda.
Seguinos — filas a Instagram, TikTok y web.

Sub-pantalla de eliminación de cuenta (destino de Eliminar mi cuenta):

Pantalla dedicada, header con ← y título Eliminar mi cuenta.
Bloque --sos-red-tint con la lista explícita de lo que se pierde: perfil, mascotas y sus fichas médicas, publicaciones, amigos, matches, historial de paseos y suscripción activa.
Aviso de suscripción: si tiene una activa, Cancelá primero tu suscripción desde la tienda. Eliminar la cuenta no la cancela.
Selector opcional de motivo (No la uso / Encontré otra app / Problemas de privacidad / Otro) con campo de texto libre.
Confirmación por contraseña, o por re-autenticación con Google/Apple si no tiene contraseña.
Checkbox Entiendo que esto no se puede deshacer.
Botón Eliminar mi cuenta en --sos-red-text sobre fondo blanco con borde rojo, deshabilitado hasta que el checkbox esté tildado y la contraseña validada.
Período de gracia de 30 días: la cuenta se marca pending_deletion y se restaura sola si el usuario vuelve a iniciar sesión antes de que venza. Decirlo en la pantalla final: Tenés 30 días para arrepentirte: si volvés a entrar antes del 02/09, recuperás todo.
3.6 Variantes de estado del índice
#	Variante	Cuándo	Qué se muestra
V1	Base	Todo OK	Lo descrito en 3.2
V2	Cargando	Preferencias todavía no resueltas	Las 11 filas se renderizan completas y tocables desde el primer frame (labels e íconos son estáticos). Solo los valores secundarios se muestran como pastillas skeleton de 60×14px con shimmer. Nunca un spinner de pantalla completa: el índice no depende del servidor para navegar.
V3	Sin conexión	No hay red	Banner 
#FEF3E0 bajo el título: ícono de wifi tachado --amber-text + Sin conexión. Los cambios se guardan cuando vuelva. Las filas siguen navegables; los cambios hechos offline se encolan (ver 4.5).
V4	Requiere atención	Hay un permiso denegado, el email sin verificar o un pago rechazado	Punto ámbar de 8px en la fila correspondiente + banner opcional arriba del primer grupo con el resumen y un acceso directo. Máximo un banner a la vez, por prioridad: pago > email sin verificar > permisos.
V5	Guardado fallido	Un PATCH de preferencia devolvió error	El control vuelve al valor anterior con una animación de 200ms y aparece un toast No pudimos guardar el cambio con acción Reintentar. Nunca se deja el control en el estado nuevo si el servidor lo rechazó.
V6	Sesión expirada	El token no es válido	Diálogo bloqueante Tu sesión expiró / Volvé a iniciar sesión para seguir. con un único botón Iniciar sesión, que limpia el estado local y navega al login.
V7	Cuenta en eliminación	pending_deletion = true	Banner --sos-red-tint fijo arriba del primer grupo: Tu cuenta se elimina el 02/09. + botón Cancelar la eliminación. Las filas de Suscripciones y Mis Mascotas quedan deshabilitadas.
3.7 Interacciones y microinteracciones
Feedback háptico: impacto ligero al tocar una fila; impacto de selección al mover un switch o elegir en un bottom sheet; impacto de advertencia al abrir un diálogo destructivo.
Toques: las filas usan cambio de fondo, no scale. Los botones sueltos (amarillos, destructivos) sí usan scale(0.97) en 120ms, igual que en el resto de Zooni.
Bottom sheets de selección: entran desde abajo en 250ms ease-out, con scrim rgba(0,0,0,0.4), border-radius: 24px 24px 0 0, handle de 36×4px --divider arriba. Se cierran con swipe hacia abajo, tocando el scrim o eligiendo una opción.
Escritura de preferencias: debounce de 400ms para sliders y campos de texto; inmediata para switches y selects. Nunca una request por cada píxel de un slider.
Sin animaciones de entrada escalonadas. Los tres grupos aparecen juntos con un fade de 150ms.
Reduce motion: con Reducir movimiento activo, todas las transiciones caen a fade de 100ms y los bottom sheets aparecen sin deslizamiento.
Rotación: bloqueada en vertical.
Búsqueda dentro de Configuración (recomendado, opcional): ícono de lupa junto al engranaje del título que abre un buscador sobre todos los labels de las 11 secciones y de sus controles internos, y navega directo al control. Con este volumen de opciones, es la mejora que más tiempo ahorra.
3.8 Accesibilidad
Contraste mínimo 4.5:1 en texto, 3:1 en íconos y bordes informativos. Ratios verificados de esta pantalla:
Combinación	Ratio	Veredicto
--text 
#2C2C2C sobre card blanca	13.97	✅
--text 
#2C2C2C sobre menta 
#C8F0D8	11.25	✅
--text-soft 
#6B6B6B sobre blanco	5.33	✅
--text-soft 
#6B6B6B sobre menta	4.29	❌ — por eso existe --text-soft-mint
--text-soft-mint 
#5A6B60 sobre menta	4.56	✅
Chevron 
#AAAAAA sobre blanco	2.32	❌ — no llega al 3:1 de gráficos
--chevron 
#8A8A8A sobre blanco	3.45	✅
--brand-text 
#177046 sobre blanco	6.10	✅
--brand 
#2DBD72 con knob blanco (switch)	2.43	❌ — el switch encendido usa --brand-text
--sos-red-text 
#B3121D sobre blanco	6.95	✅
--text sobre --cta 
#F5C842	8.79	✅
El estado de un switch nunca se comunica solo por color. Además del riel verde, el knob se desplaza y el nodo accesible expone checked / unchecked. Con Alto contraste activo, el switch encendido suma un borde de 2px --text.
Área táctil mínima real 48×48px; las filas de 56px ya cumplen.
Soporte de fuente del sistema hasta 200%: las filas crecen en alto, el valor secundario baja a una segunda línea, y ningún texto se recorta. El único ellipsis permitido es el del label de fila cuando ya cayó a dos líneas.
Orden de foco: hamburguesa → título → label de grupo 1 → filas 1-4 → label de grupo 2 → filas 5-8 → label de grupo 3 → filas 9-11 → cerrar sesión → eliminar cuenta → versión.
Cada grupo se expone como una lista con su label como encabezado, para que el lector anuncie Cuenta, lista, 4 elementos.
La ilustración de hojas del fondo se marca como decorativa y queda fuera del foco.
Todos los diálogos destructivos: el botón de confirmación no es el que recibe el foco inicial.
RAMA B — BACKEND (Supabase)
4.1 Principio de diseño

Las preferencias se dividen en tres categorías según dónde viven, y confundirlas es el error más común de esta pantalla:

Categoría	Dónde vive	Ejemplos
Preferencia de cuenta	Servidor. Sincroniza entre dispositivos	Privacidad, notificaciones, límites de uso, idioma
Preferencia de dispositivo	Solo local (MMKV / AsyncStorage). No sube al servidor	Tema, tamaño de texto, calidad de video, autoplay, caché
Permiso del sistema	Solo el SO. Se lee, nunca se escribe	Ubicación, cámara, micrófono, notificaciones

Un usuario que pone la app en oscuro en su tablet no espera que su teléfono cambie: el tema es de dispositivo. Pero si bloquea a alguien, espera que quede bloqueado en todos lados: eso es de cuenta.

4.2 Esquema de datos
user_settings — una fila por usuario
Columna	Tipo	Notas
user_id	uuid PK, FK → auth.users	1 a 1 con el usuario
privacy	jsonb NOT NULL	default '{}' — todo el bloque 3.5.6
notifications	jsonb NOT NULL	default '{}' — todo el bloque 3.5.8
wellbeing	jsonb NOT NULL	default '{}' — límites y recordatorios de 3.5.4
locale	text	default 'es-AR'
updated_at	timestamptz	default now(), actualizado por trigger
version	int	default 1, se incrementa en cada escritura — resuelve conflictos entre dispositivos

Por qué jsonb y no una columna por preferencia: son ~40 flags que van a cambiar seguido. Una columna por flag implica una migración por cada preferencia nueva. El jsonb se valida con un CHECK contra un esquema conocido y se indexa con GIN si alguna vez hay que consultar por su contenido.

sql
create index idx_user_settings_privacy on user_settings using gin (privacy);

Defaults obligatorios (aplicados por el trigger de creación de usuario, no por el cliente):

json
{
  "privacy": {
    "private_profile": false,
    "show_age": true,
    "show_zone": "neighborhood",
    "location_sharing": "friends",
    "location_precision": "approximate",
    "live_walk_location": true,
    "friend_requests_from": "everyone",
    "messages_from": "friends",
    "visible_in_match": true,
    "show_online_status": true,
    "read_receipts": true
  },
  "notifications": {
    "push_enabled": true,
    "messages": true, "friend_requests": true, "new_match": true,
    "likes_comments": true, "new_follower": true,
    "live_walk": true, "vaccine_reminders": true, "vet_appointments": true,
    "followed_places": true,
    "lost_pets_nearby": true, "map_posters": false,
    "news_tips": true, "promotions": false,
    "sound": true, "vibration": true,
    "lockscreen_preview": "always", "email_digest": false,
    "dnd_enabled": false, "dnd_from": "22:00", "dnd_to": "08:00", "dnd_days": [1,2,3,4,5,6,0]
  },
  "wellbeing": {
    "daily_limit_enabled": false, "daily_limit_minutes": 60,
    "break_reminder": "never", "weekly_summary": true
  }
}

Nótese: promotions y map_posters arrancan en false. Todo lo comercial y lo ruidoso es opt-in.

blocked_users

id, user_id, blocked_user_id, created_at. Índice único en (user_id, blocked_user_id). Bloquear es bidireccional en efecto: ninguno ve al otro, sin que el bloqueado se entere.

muted_users

Mismo esquema. Silenciar es unidireccional y sí permite que el otro siga interactuando.

user_sessions

id, user_id, device_name, device_model, os, app_version, ip_country, ip_city, last_active_at, created_at, revoked_at. Alimenta 3.5.1.

app_usage_daily

user_id, date, total_seconds, by_section jsonb, PK compuesta (user_id, date). El cliente acumula localmente y hace un solo upsert por sesión de app, no un ping por minuto.

deletion_requests

id, user_id, reason, reason_text, requested_at, scheduled_for (= requested_at + interval '30 days'), cancelled_at, completed_at.

data_export_requests

id, user_id, status (pending / processing / ready / failed), requested_at, file_url, expires_at. Rate limit: una solicitud cada 48 horas.

subscriptions

id, user_id, plan (free / plus), status (active / grace_period / cancelled / expired), store (app_store / play_store), store_transaction_id, current_period_end, cancel_at_period_end, updated_at. Fuente de verdad = los webhooks de la tienda, nunca el cliente.

4.3 Row Level Security

RLS activo en todas las tablas. Regla general: auth.uid() = user_id para select, insert y update.

Casos que necesitan más cuidado:

user_settings: sin delete. Se borra en cascada al borrar el usuario y nada más.
subscriptions: el usuario puede leer la suya; update solo service_role. Si el cliente pudiera escribir su plan, cualquiera se auto-asigna Plus.
user_sessions: select propio y update propio limitado a setear revoked_at. Sin insert desde el cliente.
deletion_requests: insert y update propios (para poder cancelar), sin delete.
app_usage_daily: insert y update propios. Validar en un trigger que total_seconds no supere 86400 y que la fecha no sea futura, para que el dato no sea manipulable.
blocked_users: el bloqueado no puede leer la fila que lo bloquea. Se filtra por auth.uid() = user_id, nunca por blocked_user_id.
4.4 Funciones y endpoints
Función	Qué hace
get_user_settings()	Devuelve la fila completa. Si no existe, la crea con los defaults y la devuelve — nunca falla por ausencia
update_user_settings(p_patch jsonb, p_version int)	Merge parcial (jsonb deep merge), no reemplazo. Valida el patch contra el esquema conocido y rechaza claves desconocidas. Si p_version no coincide con la versión actual, devuelve conflicto (ver 4.5)
block_user(p_user_id) / unblock_user(p_user_id)	Bloquea y, en la misma transacción, elimina la amistad, cancela solicitudes pendientes y saca al usuario del pool de match del otro
revoke_session(p_session_id)	Marca revoked_at e invalida el refresh token
revoke_all_sessions()	Todas menos la actual
request_account_deletion(p_reason, p_reason_text)	Crea la solicitud, marca pending_deletion en el perfil y programa el job
cancel_account_deletion()	Revierte. Se llama solo al iniciar sesión dentro de los 30 días
request_data_export()	Encola el export. Rechaza si hay una solicitud de menos de 48 horas
upsert_app_usage(p_date, p_seconds, p_by_section)	Suma al acumulado del día

Cambios de credenciales (email, contraseña, 2FA) van por Supabase Auth, no por funciones propias: updateUser, verifyOtp, resetPasswordForEmail. Todos exigen re-autenticación reciente (menos de 5 minutos) o la contraseña actual.

4.5 Sincronización y conflictos
Al abrir la app: get_user_settings() y merge sobre el estado local. Gana el servidor para las preferencias de cuenta, gana el local para las de dispositivo.
Realtime: suscripción a user_settings filtrada por user_id = auth.uid(). Si el usuario cambia algo en otro dispositivo, la pantalla lo refleja sin recargar. Si la pantalla está abierta y llega un cambio remoto, el control se actualiza con la misma animación que si lo hubiera tocado el usuario, sin toast.
Escritura optimista: el control cambia primero, la request va después. Si falla, rollback + V5.
Conflictos con version: cada update manda la versión que el cliente cree tener. Si el servidor ya está en una posterior, devuelve 409 con el estado actual; el cliente re-aplica solo su patch sobre ese estado y reintenta una vez. Después de un segundo conflicto, muestra el estado del servidor y no insiste.
Cola offline: los cambios hechos sin red se guardan en una cola local con timestamp y se envían al recuperar conexión, en orden, colapsando patches repetidos de la misma clave (si el usuario prendió y apagó el mismo switch tres veces, se manda el estado final, no tres requests).
4.6 Contratos que consume el frontend
Momento	Llamada	Bloquea UI
Al montar el índice	get_user_settings()	No — las filas se renderizan con labels estáticos y solo los valores secundarios muestran skeleton (V2)
Al montar el índice	Lectura de permisos del SO	No
Al montar el índice	subscriptions del usuario	No
Cambiar un switch / select	update_user_settings(patch, version)	No, optimista
Mover un slider	update_user_settings con debounce 400ms	No
Volver del sistema (AppState → active)	Re-lectura de permisos	No
Abrir Mis Mascotas	pets del usuario	Skeleton de lista
Cambio de email / contraseña	Supabase Auth	Sí, con loader en el botón Guardar y timeout de 15s
Eliminar cuenta	request_account_deletion	Sí, es la única acción irreversible
Cierre de la app / background	upsert_app_usage(...)	No, fire-and-forget
4.7 Errores y contingencias
Caso	Comportamiento
get_user_settings falla	Se usan los defaults locales, banner V3, y las filas siguen navegables
update_user_settings falla (5xx / timeout)	V5: rollback del control + toast con Reintentar
Conflicto de versión (409)	Re-aplicar el patch sobre el estado del servidor y reintentar una vez
Sin red	V3 + cola offline
Token expirado	V6, diálogo bloqueante
Permiso denegado en el SO	Estado Denegado en rojo + atajo a los ajustes. Nunca re-pedir el prompt nativo
Notificaciones denegadas en el SO pero push_enabled = true en el servidor	Gana el SO: el switch maestro se muestra apagado y deshabilitado, con el apoyo explicando por qué
Suscripción de la tienda no confirmada	Estado Procesando en la card de plan, con reintento de validación cada 30s durante 5 min
request_data_export antes de las 48 h	Toast Ya pediste tus datos el 03/08. Podés volver a pedirlos el 05/08.
Eliminar cuenta con suscripción activa	Se permite, pero con el aviso de que la suscripción hay que cancelarla en la tienda
Vaciar caché mientras hay una descarga en curso	Se cancela la descarga y se avisa
5. Criterios de aceptación
Las 11 filas aparecen en el orden exacto de la tabla 3.4, en tres grupos de 4, 4 y 3.
Ninguna fila del índice contiene un switch, un slider ni un selector: todas navegan.
Tocar cualquier punto de una fila, de borde a borde de la card, navega a su sub-pantalla.
Ningún ícono es un emoji. Los 11 son vectoriales y se tiñen con el color de su tinte.
Ninguna sub-pantalla tiene botón Guardar, salvo cambio de email, cambio de contraseña y eliminación de cuenta.
Cambiar el tema se aplica al instante, sin reiniciar la app.
Cambiar una preferencia en un dispositivo la actualiza en otro dispositivo con la sesión abierta, por Realtime y sin recargar.
Con el modo avión activo, cambiar tres switches y volver a tener red envía un patch consolidado, no tres.
Si el servidor rechaza un cambio, el control vuelve al valor anterior. No queda nunca en el estado nuevo.
Con las notificaciones denegadas en el SO, el switch maestro aparece apagado y deshabilitado con su explicación.
Volver de los ajustes del sistema refresca los estados de permisos sin recargar la pantalla.
El chevron usa 
#8A8A8A o más oscuro, y ningún texto sobre el fondo menta usa 
#6B6B6B.
El switch encendido usa --brand-text 
#177046 y no 
#2DBD72.
Eliminar mi cuenta tiene menos peso visual que Cerrar sesión y exige checkbox + re-autenticación.
Con el tamaño de fuente del sistema al 200%, las 11 filas siguen legibles y ningún label se corta a mitad de palabra.
Un lector de pantalla anuncia cada grupo como lista con su cantidad de elementos.
En los diálogos destructivos, el foco inicial no está en el botón de confirmar.
Un usuario no puede modificar su propia fila de subscriptions (verificar con una llamada directa a la API).
Toque largo sobre la versión copia los datos de diagnóstico.
6. Fuera de alcance de esta versión

Idiomas más allá de es-AR; exportación de datos en formato legible por máquina más allá del JSON; gestión de dispositivos IoT (collares) más allá del permiso de Bluetooth; cuentas de negocio para veterinarias y paseadores (es otra pantalla completa); y widgets de sistema.

Anexo — Qué cambia respecto de la pantalla actual
Elemento	Hoy	Este prompt	Por qué
Íconos de fila	Emojis	Íconos vectoriales en cuadrado con tinte	Los emojis no se tiñen, cambian entre plataformas, no escalan con la fuente accesible y ensucian el lector de pantalla
Engranaje del título	Emoji ⚙️	Ícono vectorial 24px	Igual que arriba, y además desalinea la línea de base
Labels de grupo	No hay	Cuenta / Mascotas y privacidad / App y soporte	11 filas sin encabezados obligan a leer todo el índice
Chevron	
#AAAAAA (2.32:1)	--chevron 
#8A8A8A (3.45:1)	No llegaba al mínimo de 3:1 de elementos gráficos
Valor secundario en las filas	No hay	Claro, 3 mascotas, Plan Free…	Deja ver el estado sin entrar a cada sección
Cerrar sesión	No visible en el screenshot	Card propia al pie, en rojo	Es la acción que más se busca en un índice de configuración
Eliminar cuenta	No visible	Texto suelto bajo la card, con flujo de 8 pasos y 30 días de gracia	Requisito legal y de tienda; además tiene que ser difícil de tocar por accidente
Versión de la app	No visible	Pie centrado, con copia de diagnóstico al toque largo	Primera pregunta de cualquier ticket de soporte
Estados de error / vacío	No definidos	7 variantes	La pantalla no puede fallar en silencio
Barra compacta al scrollear	No hay	Aparece a los 40px de scroll	Con 11 filas el título se va de pantalla y se pierde la referencia
Buscador de opciones	No hay	Recomendado, opcional	Con ~40 controles repartidos en 11 secciones, es lo que más tiempo ahorra