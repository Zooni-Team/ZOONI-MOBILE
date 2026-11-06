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
| `MESES`, `DIAS_SEMANA` | nombres en minúscula (`capitalizar` si hace falta) |

`utils/tiempoRelativo.js` — "hace 5 min", "Ayer", "en línea": `horaCorta`,
`mismoDia`, `etiquetaDia`, `tiempoRelativo`, `tiempoRelativoCorto`, `estadoPresencia`.

`utils/colorProximidad.js` — color y texto según cuánto falta para una fecha.

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

## Archivos y PDF
- `utils/imagenStorage.js` — `subirImagenPublica(uri, carpeta)`,
  `subirArchivoPublico(uri, carpeta, { bucket, mimeHint })`. Sube a
  `<auth uid>/<carpeta>/` (lo exige Storage, ver [seguridad](seguridad.md#storage)).
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
