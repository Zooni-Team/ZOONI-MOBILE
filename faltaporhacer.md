# Falta por hacer

Ordenado por prioridad. Lo hecho en la última pasada está al final.

## 1. Para que lo hecho funcione (en este orden)

1. **Base de datos** — Supabase → SQL Editor, pegar cada archivo entero → Run,
   en orden: `supabase/MIGRACION_064_SOBRE_063.sql`, `…065…`, `…066…`,
   `…067…`, `…068_ARCHIVOS_HUERFANOS.sql`. Cada uno se fija que esté el
   anterior, verifica lo que hizo y es idempotente: volver a pegar uno que ya
   estaba no rompe nada. Si la base ya tiene hasta la 067, alcanza con la 068.
   (Base vacía: primero `supabase/SUPABASE_PEGAR_TODO.sql` y después esos cinco.)
2. **ZooniVet** — la función cambió (nombre leído de la base, tiempo máximo,
   errores sin detalles internos):
   ```bash
   supabase functions deploy zoonivet-chat
   ```
3. **Borrar la Edge Function vieja** si alguna vez se desplegó (era un
   oráculo de contraseñas sin límite; la app ya no la llama):
   ```bash
   supabase functions delete migrar-cuenta
   ```
4. **Storage** — mudar las imágenes de consultas viejas al bucket privado y
   borrar los archivos huérfanos (clave service_role: Project Settings → API;
   nunca va en la app ni en el repo). Primero en modo prueba:
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node supabase/scripts/limpiar-storage.mjs
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/scripts/limpiar-storage.mjs --aplicar
   ```
   Conviene repetirlo cada tanto (las mascotas purgadas van dejando archivos).
5. **Authentication → Providers → Email → "Confirm email" activado** (hallazgo
   #21 del informe: con la auto-confirmación, un `signUp` con un mail ajeno
   puede quedarse con una cuenta vieja sin migrar). Es una opción del panel:
   no se puede fijar desde el SQL.
6. **Desplegar la app** (Vercel redespliega solo al pushear).
7. **Probar en la app real, contra la base real** (lo de acá se probó con una
   base local y con un Supabase simulado; ver "Cómo se verificó" abajo):
   login con cuenta vieja, registro, Match, pedido, turno, paseo completo,
   ZooniVet, subir foto, consulta con imagen, chat en vivo con dos sesiones,
   Calendario, Eventos, Tiempo en la app.

## 2. Decisiones de producto pendientes

- **Veterinarias reales** en `veterinary_clinics`: hoy el SOS muestra las
  líneas de emergencia y la salida a Google Maps, sin lista propia.
- **Verificación de paseadores**: no hay quién verifique. El dueño ve
  "Identidad sin verificar todavía" y puede contratar igual. `verificado` sólo
  lo cambia alguien con acceso al SQL (067).
- **Dos Match con la misma persona** (uno por mascota) son dos chats; se
  distinguen por las mascotas en el nombre. ¿Unificarlos?

## 3. Código

- **Modo oscuro**: no existe ("Próximamente" en Configuración › Tema). Ahora
  es viable: todos los colores salen de `theme/colores.js` (`npm test` lo
  controla), pero hay que diseñar la paleta oscura y revisar pantalla por
  pantalla.
- Pantallas todavía grandes (500–850 líneas): `NegocioPublicoScreen`,
  `MisMascotasScreen`, `ClosetScreen`, `PerfilScreen`, `SosScreen`,
  `ComunidadScreen`, `FichaMedicaScreen`. Mismo método que Home, Calendario,
  Eventos y las de salud: carga de datos a un hook, piezas a
  `components/<tema>/`.
- ZooniVet: el historial de la conversación lo manda la app, así que alguien
  con su propia sesión puede fabricar respuestas "previas" del asistente
  (hallazgo #43). Arreglo de fondo: guardar la conversación en la base.
- Probar en iOS y Android (la prueba de humo de esta pasada fue en la web).

## 4. Defensa oral
Repasar `docs/claude/flujos.md` (responde las preguntas de la devolución) y
`docs/claude/base-de-datos.md` (orden de los SQL y qué hace cada migración).

---

## Hecho en la última pasada (16/11/2026)

**Base (068, con `pruebas_068.sql`)**
- Archivos que quedaban para siempre en Storage al borrar una mascota, una
  foto o una consulta (o al reemplazar la foto): triggers los anotan en
  `archivos_por_borrar`; `limpiar-storage.mjs` los borra (con prueba propia).
- Imágenes de consultas anteriores a la 064 (bucket público): el mismo script
  las muda a `consultas-privadas/<auth uid>/consultas/`.
- Se borran las RPC del login con hash (`login_user`, `registrar_*`/`activar_*`
  con `p_hash`, `cambiar_contrasena`) y las de la Edge Function vieja (#102).
- `SUPABASE_PEGAR_TODO.sql` vuelve al repo (lo habían quitado en `9703ecf` y
  dejaba sin reconstruir la base ni correr las pruebas de RLS, #51), con el
  orden explícito; `probar-esquema.mjs` corre la secuencia real
  (base + 064…068) dos veces y todas las pruebas.

**Seguridad**
- Fuera la Edge Function `migrar-cuenta` (#8) y el login viejo de la app
  (`authLegado.js`, #80): la 065 migra las cuentas desde la base. Si la base no
  responde, el login dice "no se pudo conectar" y no "contraseña incorrecta".
- ZooniVet: el nombre lo lee la función (#94), errores sin texto de Postgres
  (#93), `petId` validado (#99), tope de tamaño y tiempo máximo con Groq
  (#97), cliente de Supabase con versión exacta desde npm (#45).
- "Restablecer" en los filtros de Match **borraba todos los votos reales** de
  la mascota (`resetDemoMatchState`, #128): ahora sólo restablece los filtros.

**Datos inventados que se veían en la app**
- Configuración mostraba `nacho@zooni.app` a todos, "1 h 12 min hoy" y una
  versión ficticia: ahora el mail de la sesión, el uso real y `app.json`.
- "Tiempo en la app" era un gráfico fijo: ahora `services/usoApp` mide el uso
  en primer plano, lo guarda en `app_usage_daily` y avisa (límite, descanso,
  resumen del lunes) sin bloquear.
- Consultas y Tratamientos mostraban "Vista previa — conectá el backend".

**Refactor**
- `paseadorApi.js` (1.518 líneas) → `services/paseador/` (8 archivos por
  tema) + `services/geocodificacion.js`; `negocioApi.js` (1.159) →
  `services/negocio/` + `domain/negocios.js` (lógica pura, probada sin base).
  Los barriles mantienen los imports de las pantallas.
- Vacunas (766 → 223 líneas), Tratamientos (756 → 192) y Consultas (614 → 195)
  sobre piezas comunes: `components/salud/*` + `hooks/useRegistrosSalud`.
  `CardAplicado`/`CardSugerido` quedaron en un solo diseño (`TarjetaRegistro`,
  `TarjetaSugerido`).
- Home (895 → 165): `useHome` + `home/HeroMascota` + `home/BotonesHome`.
  Calendario (915 → 168): `useCalendario` + `components/calendario/*`.
  Eventos (1.016 → 187): `useEventosPublicos` + `eventos/EventoPublicoCard`.
  `EventoCard` de Calendario y de Eventos eran dos cosas distintas con el mismo
  nombre: ahora `RecordatorioCard` y `EventoPublicoCard`. `PetIllustration` de
  la Ficha era un `<Image>` con otro nombre: se inlineó.
- `edadDe` (registro de paseador) → `calcularEdadAnios`. Seis copias de "hora
  HH:MM" → `horaCorta`. `cuentaRegresiva` central ("Vence hoy" ya no sale en
  rojo como vencido).
- Grises: de 11 a 5 (`gris50`…`gris400`). Sombras con nombre (`suave`, `sutil`,
  `modal`). `verificar-colores.mjs` en `npm test`.
- `src/api/comunidad` → `services/comunidadApi.js`; `utils/imagenStorage` →
  `services/`; `data/matchDemo.js` (perfiles de demo) → `constants/match.js`
  sin la demo. `PerfilTab` ya no consulta la base directo. Comentarios que
  citaban archivos SQL inexistentes, corregidos. Sin `expo-crypto` (sólo lo
  usaba el login viejo).

**Cómo se verificó**
- `npm run lint` sin errores ni avisos; `npm test`: 57 pruebas + PDF + paseos +
  colores. Nuevas: imports que no existen (`imports.test.mjs`), ninguna
  pantalla importa Supabase, tiempo de uso, limpieza de Storage.
- `probar-esquema.mjs` en Postgres 16: secuencia completa dos veces + pruebas
  RLS y 064–068.
- `expo export --platform web` y recorrido en Chrome sin cabeza contra un
  Supabase simulado: Inicio (cambio de mascota), Ficha, Vacunas, Tratamientos,
  Consultas (altas, ediciones, bajas y validaciones), Calendario (alta con fecha,
  hora, tipo y emoji; detalle; baja), Eventos (agregar al calendario),
  Configuración, Tiempo en la app y las demás pantallas del menú: sin errores
  de consola. `deno check` de `zoonivet-chat`.
