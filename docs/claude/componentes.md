# Componentes compartidos (`zooni-app/src/components`)

← [índice](README.md) · estilos en [estilos](estilos.md) · fechas en [utilidades](utilidades.md#fechas)

**Antes de crear un componente, buscá acá.** Si hay uno parecido, agregale una
prop. Si creás uno que se va a usar en más de una pantalla, va a `components/ui/`
(o al kit del módulo) y se agrega a esta tabla.

## Avisos, carga y diálogos

| Necesito… | Usá | Cómo |
|---|---|---|
| Un aviso breve flotante ("Guardado ✓") | `ui/Toast` + `hooks/useToast` | `const { toast, mostrarToast } = useToast(); mostrarToast('Listo'); <Toast {...toast} />` · color: `mostrarToast('Error', colores.rojo)` |
| Un aviso que ocupa lugar en el layout | patrón `AvisoInline` de `PerfilScreen` con el mismo `useToast` | |
| Placeholder mientras carga | `ui/Skeleton` (`<Skeleton style={s.card}>…</Skeleton>`) o `SkeletonBloque` (`width`, `height`) | la animación ya está; vos das la forma |
| Alerta / confirmación que funcione en web | `utils/dialogo` → `alerta(titulo, texto)`, `confirmar(...)` | `Alert.alert` no anda en web |
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
| Panel de notificaciones de Home | `NotificationsPanel` |
| Perfil de otra persona | `PersonaProfileModal` |
| Botones de Home y su modal | `NavButton`, `AddButtonModal`, `DraggableList` |
| Login con Google / Facebook | `BotonesSociales` |

## Formularios
`ui/Campo.jsx` (label + ayuda/error alrededor de un input) y
`ui/InputPassword.jsx` (input de contraseña con ojito) — antes duplicados en
`NegocioRegistroScreen` y `PaseadorRegistroScreen`. Reciben `styles` (el `s`
de la pantalla) y, `InputPassword`, también `colores` (el `C` de la pantalla).

## Puntajes
`ui/Estrellas.jsx` — `Estrellas` (sólo lectura, con medias estrellas para
promedios) y `EstrellasInput` (para elegir tocando, sin medias; prop
`borrable` para poder volver a 0). Antes cuatro definiciones casi iguales
repartidas en `resenas/*`, `MisPaseosScreen` y `Paseador/tabs/PerfilTab`.

## Ficha médica
`fichaMedica/CardAplicado.jsx` y `fichaMedica/CardSugerido.jsx` — tarjeta de un
ítem aplicado y de uno sugerido del calendario (Vacunas, Tratamientos). Reciben
el `styles` de la pantalla (cada una sigue dueña de su paleta) y los datos ya
formateados (`lineas`, `contador`, `estado`…); `CardSugerido` tiene dos
layouts: `"simple"` (Tratamientos) y `"detallado"` (Vacunas, con estado y dosis).

## Ilustración de mascota
`ui/PetIllustration.jsx` — imagen de la mascota con la sombra siguiendo su
silueta (no un cuadrado). Antes duplicado en HomeScreen y FichaMedicaScreen.
Props: `source`, `label`, `style` + opcionales `esFoto`/`estiloFoto` (foto
real: recorte/marco) y `sombra`/`estiloSombraWeb`/`estiloSombraIOS` (sólo
HomeScreen la pide; FichaMedica sigue sin sombra, que es el default).

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

## Elegir fotos
`utils/elegirImagen.elegirImagen({ origen, calidad, allowsEditing, aspect, frontal })`
— pide permiso, abre galería o cámara y devuelve la uri ya recomprimida sin
EXIF (sin la ubicación GPS de la foto). Para fotos + video con selección
múltiple (reseñas de paseo): `elegirMultimedia({ origen, limite })`.
Para **subir** la foto elegida: `utils/imagenStorage.subirImagenPublica(uri, carpeta)`.
