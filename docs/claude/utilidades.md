# Utilidades, dominio, constantes y hooks

← [índice](README.md) · las usan [componentes](componentes.md) y [servicios](servicios.md) · se prueban en [testing](testing.md)

Todo esto es lógica **pura** (salvo hooks): se prueba sin conexión en
`zooni-app/tests/utils.test.mjs`.

## Fechas
`utils/fechaLocal.js` — **único** módulo para leer y mostrar fechas.

| Función | Para qué |
|---|---|
| `parseFechaLocal(x)` | `"YYYY-MM-DD"` / ISO / Date → Date local, o `null`. **Nunca** `new Date('2026-08-14')` (en Argentina da el día anterior) |
| `toISODateLocal(d)` | Date → `"YYYY-MM-DD"` para guardar en la base |
| `formatearFecha(x, estilo)` | `'numerica'` 14/8/2026 · `'numericaCeros'` 14/08/2026 · `'larga'` 14 de agosto de 2026 · `'diaSemana'` jueves, 14 de agosto · `'diaSemanaCorto'` · `'corta'` 14 ago 2026. Opción `{ vacio: '—' }` |
| `diasHasta(x)` · `diasEntre(a, b)` | días calendario (vencimientos, controles) |
| `cuentaRegresiva(x, { diasAviso })` | `{ texto: 'Faltan 4 días', tono: 'vencido' \| 'pronto' \| 'lejos' }`; el color lo elige la pantalla |
| `fechaHoraFija(x)` | "Mié 12/11 12:00" para textos que se guardan (notificaciones) |
| `MESES`, `DIAS_SEMANA` | nombres en minúscula (`capitalizar` si hace falta) |

`utils/tiempoRelativo.js` — "hace 5 min", "Ayer", "en línea": `mismoDia`,
`etiquetaDia`, `tiempoRelativo`, `tiempoRelativoCorto`, `estadoPresencia`, y
**`horaCorta(x)`, la única función que arma una hora "09:05"** (antes había
seis copias: `horaDe`, `horaTexto`, `aTexto`…; `domain/paseos.horaDe` ahora
sólo agrega el "--:--" de un paseo sin hora).

`utils/colorProximidad.js` — color y texto según cuánto falta para una fecha
(usa `diasHasta`).

## Edades
`utils/calcularEdad.js` — `calcularEdad` ("4 años y 2 meses"), `edadResumida`
("4 años"), `calcularEdadPartes`, `calcularEdadMeses`, `calcularEdadAnios`.

## Texto y validación
- `utils/texto.js` — `normalizarBusqueda` (sin tildes/mayúsculas, para filtrar),
  `incluyeTexto`, `claveComparable` (sólo letras y números: comparar nombres de
  lugares), `capitalizar`.
- `utils/validacion.js` — `EMAIL_REGEX`, `PASSWORD_MIN` (7), `esEmailValido`,
  `esPasswordValida`.
- `utils/sanitizar.js` — `sanitizarTexto`, `sanitizarDigitos`, `sanitizarDecimal`,
  `sanitizarEmail`… antes de mandar a la base.

## Distancias
`utils/geo.js` — `distanciaMetros(a, b)`, `distanciaKm(a, b, decimales)`. Si falta
una coordenada devuelve `null`: quien llama decide (ej. `?? Infinity` para
ordenar al final).

## Dominio
`domain/paseos.js` — precios por duración (`serviciosDe`, `precioPara`,
`validarServicios`), comisión (`comisionDe`), tiempos (`segundosDePaseo`,
`sePuedeRetomar`), cobros (`MEDIOS_PAGO`, `MODALIDADES_COBRO`, `ultimoCierre`,
`proximoCierre`), formatos (`formatoPlata`, `formatoDistancia`, `formatoTimer`,
`formatoTiempoPaseado`, `cuandoDe`, `horaDe`). **La base recalcula precio y
comisión** (`062`): si cambia una regla, cambiala en los dos lados.

`domain/negocios.js` — horarios (`minutosDe`, `horarioDelDia`, `abiertoAhora`,
`resumenHorarios`, `turnosLibres`), precios (`precioItem`, `textoPrecioItem`,
`validarItem`, `precioTurno`, `recargoDomicilio`), envío (`costoEnvio`),
pasos (`ACCIONES_TURNO`, `siguienteEstadoPedido`, `unidadesDe`) y formatos
(`diaTexto`, `cuandoTexto`). Mismo criterio: lo que vale lo decide la base
(`_turno_al_crear`, `_pedido_al_crear`); esto es para mostrar y avisar rápido.

## Archivos y PDF
- Subir archivos: `services/imagenStorage.js` (habla con Storage, por eso es un
  servicio) — `subirImagenPublica`, `subirArchivoPublico`, `subirImagenPrivada`,
  `urlsFirmadas`. Sube a `<auth uid>/<carpeta>/` (ver [seguridad](seguridad.md#storage)).
- `utils/imagenBase64.js` — imagen de mascota a data URI (para el PDF).
- `utils/fichaPdf.js` — arma la ficha médica en PDF (`npm run verify:pdf`).

## Navegación y sesión
- `utils/rutaSegunRoles.js` — a qué "app" entra una cuenta (dueño, paseador, negocio).
- `utils/volverOLogin.js` — "volver" que no deja a nadie en una pantalla vacía.
- `config/session.js` — `getCurrentUserId`, `restaurarSesion`, `clearCurrentUserId`, modo de la app.

## Constantes
`constants/negocios.js` (qué cambia entre veterinaria/peluquería/pet shop),
`constants/intervalos.js` (cada cuánto se refresca: `INTERVALO_CHAT_MS`,
`INTERVALO_BANDEJA_MS`, `INTERVALO_LISTAS_MS`), `constants/mascotaVacia.js`
(placeholder neutro cuando no hay mascota), `constants/pesoPorEspecie.js`,
`constants/consejosData.js`, `constants/categoriasConsejos.js`,
`constants/registroAssets.js`, imágenes (`petImages`, `avatarImages`,
`registroImages`, `homeAssets`).

## Hooks
`useToast` (avisos), `useMisMascotas`, `useUsuarioActivo`, `useSeguimientoPaseos`
(GPS de paseos en curso). `components/ui/Skeleton` exporta `usePulso`.

## Constantes
`constants/` — catálogos fijos de la app: `negocios` (tipos, tamaños, horarios
por defecto), `match` (filtros por defecto, tipos de mascota, intereses,
géneros), `pesoPorEspecie`, `petImages` / `avatarImages` (ilustraciones),
`mascotaVacia` (placeholder neutro: nunca una mascota inventada), `rutas`.

## Hooks
| Hook | Para qué |
|---|---|
| `useToast` | estado del `<Toast />` |
| `useUsuarioActivo` | usuario y mascota activa (para el menú) |
| `useMisMascotas` | mascotas activas (selector) |
| `useRecargaEnVivo` | chats por Realtime con respaldo cada 30 s |
| `useSeguimientoPaseos` | paseos en curso del dueño |
| `useRegistrosSalud(traer)` | Vacunas / Tratamientos / Consultas: mascota, registros, sugeridos, error y reintento |
| `useHome` · `useCalendario` · `useEventosPublicos` | datos de esas pantallas, con los cambios optimistas |
