# Componentes compartidos (`zooni-app/src/components`)

← [índice](README.md) · estilos en [estilos](estilos.md) · fechas en [utilidades](utilidades.md#fechas)

**Antes de crear un componente, buscá acá.** Si hay uno parecido, agregale una
prop. Si creás uno que se va a usar en más de una pantalla, va a `components/ui/`
(o al kit del módulo) y se agrega a esta tabla.

## Avisos, carga y diálogos

| Necesito… | Usá | Cómo |
|---|---|---|
| Un aviso breve flotante ("Guardado ✓") | `ui/Toast` + `hooks/useToast` | `const { toast, mostrarToast } = useToast(); mostrarToast('Listo'); <Toast {...toast} />` · color: `mostrarToast('Error', colores.rojo)` · con ícono, botón y duración: `mostrarToast('Archivada', { icono: 'archive', accion: { texto: 'Deshacer', onPress }, duracionMs: 6000 })` + `<Toast {...toast} onCerrar={ocultarToast} />` · abajo: `posicion="abajo"`. Es el ÚNICO aviso flotante: no hacer copias propias. |
| Un aviso que ocupa lugar en el layout | patrón `AvisoInline` de `PerfilScreen` con el mismo `useToast` | |
| Placeholder mientras carga | `ui/Skeleton` (`<Skeleton style={s.card}>…</Skeleton>`) o `SkeletonBloque` (`width`, `height`) | la animación ya está; vos das la forma |
| Alerta / confirmación que funcione en web | `utils/dialogo` → `alerta(titulo, texto)`, `await confirmar(titulo, texto, { textoOk, destructivo })` | `Alert.alert` con botones no anda en web |
| "No se pudo cargar" con Reintentar | `salud/AvisoError` (`mensaje`, `onReintentar`) | nunca mostrar "no hay nada" cuando lo que pasó es un error |
| Cartel modal con estilo Zooni | `AppDialog` | |

## Elegir valores

| Necesito… | Usá | Notas |
|---|---|---|
| **Una fecha** | `FechaPicker` | Props: `visible, titulo, valor (Date), onConfirmar(Date), onCancelar, aniosAtras, aniosAdelante, sinFuturo`. Es EL selector de fechas de la app (Vacunas, Tratamientos, Consultas, Ficha, Calendario, alta/edición de mascota, registro de paseador, Match, pagos, informes). Para mostrar la fecha elegida: `formatearFecha(d, 'larga')` |
| Una hora | `HoraPicker` | `visible, valor (Date), onConfirmar(Date), onCancelar, titulo` |
| Una opción de una lista | `OpcionPicker` | dropdown en modal |
| Construir otro picker de rueda | `RuedaSeleccion` (`Columna`, estilos `rs`) | base de Fecha/HoraPicker |
| Un valor en un rango | `SliderAmarillo` · `match/SimpleSlider` · `match/SimpleRangeSlider` | |
| Cambiar de mascota | `SelectorMascota` | |
| Ubicación + radio en un mapa | `paseador/ZonaMapaPicker` | lo usan paseadores y negocios |

## Estructura de pantallas

| Pieza | Componente |
|---|---|
| Menú lateral del dueño | `HamburgerDrawer` (proveedores: `paseador/PaseadorDrawer`) |
| Encabezado de la Ficha Médica y sus secciones | `PetHero` |
| Pantalla de registros de salud (Vacunas, Tratamientos, Consultas) | `salud/PantallaSalud` (volver, selector de mascota, hero, hoja blanca, recargar, Toast) + `hooks/useRegistrosSalud(traer)` |
| Sección con título, "Añadir" y lista que resuelve cargando / vacía / con datos | `salud/SeccionSalud` |
| Un registro cargado (con editar / eliminar opcionales y espacio para una imagen) | `salud/TarjetaRegistro` |
| Algo sugerido por el calendario ("Registrar" / "Aplicada") | `salud/TarjetaSugerido` |
| Formulario corto en una ventana (título, campos, Cancelar / Guardar fijos, error adentro) | `salud/ModalFormulario` + `CampoTexto`, `CampoFecha` |
| Inicio: mascota animada con flechas y foto/avatar | `home/HeroMascota` · botones: `home/BotonesHome` · datos: `hooks/useHome` |
| Calendario de Cuidados | `calendario/RecordatorioCard`, `RecordatorioDetalleModal`, `FormularioRecordatorio` · datos: `hooks/useCalendario` |
| Evento público (agenda) | `eventos/EventoPublicoCard` · datos: `hooks/useEventosPublicos` |
| Panel de notificaciones de Home | `NotificationsPanel` |
| Perfil de otra persona | `PersonaProfileModal` |
| Botones de Home y su modal | `NavButton`, `AddButtonModal`, `DraggableList` |
| Login con Google / Facebook | `BotonesSociales` |

## Kits por módulo
- **Proveedores** (`paseador/PaseadorUI.jsx`): `C`, `sombra`, `PillButton`, `Card`,
  `Chip`, `Stat`, `Avatar`, `Seccion`, `Vacio`, `SwitchGrande`.
- **Negocios** (`negocio/NegocioUI.jsx`): `EstadoChip`, `Etiqueta`, `Segmento`,
  `TurnoCard`, `PedidoCard`, `MotivoModal`.
- **Configuración** (`settings/SettingsKit.jsx`): `SettingsScreen`, `SettingsGroup`,
  `SettingsRow`, `SettingsToggle`, `SettingsSelect`, `SettingsSlider`,
  `SettingsAction`, `SettingsInfo`, `SettingsBanner`.
- **Match** (`match/`), **Comunidad** (`Comunidad/`), **Reseñas** (`resenas/`):
  componentes propios de cada módulo.

- **Formularios** (`ui/CampoFormulario.jsx`): `Campo` (rótulo + ayuda + error),
  `InputPassword`, `estilosCampo`.
- **Calificaciones** (`ui/Estrellas.jsx`): `Estrellas` (mostrar, admite medias)
  y `EstrellasInput` (elegir; `borrable`).
- **Especie** (`EspecieTile.jsx`): tarjeta para elegir perro/gato/… (registro y
  alta de mascota).

## Elegir fotos
Siempre con `utils/elegirImagen`: `await elegirImagen({ camara, cuadrada, frontal, calidad })`
devuelve la uri o `null` (canceló / sin permiso; el aviso ya lo muestra).
Para varias fotos y videos (reseñas): `elegirMedios({ camara, limite })`.
Nunca llamar a `expo-image-picker` directo desde una pantalla.

Toda foto que sale de ahí se recomprime, así que va **sin EXIF** (sin la
ubicación GPS de quien la sacó): informe de seguridad #69. Es la razón de más
peso para no saltear este helper.

Para **subir** la foto elegida: `services/imagenStorage.subirImagenPublica(uri, carpeta)`.
Si es información clínica (consultas): `subirImagenPrivada(uri, carpeta)` devuelve
la **ruta** en el bucket privado, y se muestra con `urlsFirmadas([rutas])`.

## Pantallas grandes: cómo se parten

Una pantalla dibuja; la carga de datos va a un hook (`hooks/useXxx`) y cada
pieza que se puede nombrar va a su archivo en `components/<tema>/`. Ejemplos:
`HomeScreen` (165 líneas) = `useHome` + `HeroMascota` + `BotonesHome`;
`CalendarioScreen` = `useCalendario` + `components/calendario/*`. Las
animaciones que sólo le importan a una pieza viven en esa pieza.

Otros ya partidos: `ClosetScreen` = `useAvataresCloset` +
`components/closet/PiezasCloset`; `MisMascotasScreen` =
`components/mascotas/TarjetasMascota` (tarjetas, tokens de la pantalla);
`NegocioPublicoScreen` = `components/negocio/HojaPedido` (carrito y pedido) +
`components/negocio/FichaNegocioUI` (sellos, títulos, `sellosDeNegocio`).
