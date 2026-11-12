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

Para **subir** la foto elegida: `utils/imagenStorage.subirImagenPublica(uri, carpeta)`.
Si es información clínica (consultas): `subirImagenPrivada(uri, carpeta)` devuelve
la **ruta** en el bucket privado, y se muestra con `urlsFirmadas([rutas])`.
