# Falta por hacer

Ordenado por prioridad. Lo hecho en la última pasada está al final.

## 1. Para que lo hecho funcione (en este orden)

1. ~~**Base de datos**~~ — **hecho el 19/11/2026**: la base de producción tiene
   la secuencia completa, `064` → `068` + `070`. Verificado con
   `SELECT to_regclass('public.mascota_publica')`.

   Para una base nueva (o si hay que rehacerla), el orden es:
   `supabase/SUPABASE_PEGAR_TODO.sql` y después, cada uno entero,
   `MIGRACION_064_SOBRE_063.sql`, `…065…`, `…066…`, `…067…`,
   `…068_ARCHIVOS_HUERFANOS.sql` y por último
   `…070_ENDURECIMIENTO_SEGURIDAD.sql`. Cada uno se fija que esté el anterior,
   verifica lo que hizo y es idempotente.

   ⚠ **La 070 va última a propósito.** Endurece políticas que la 066 restituye
   permisivas (la que corre al final es la que queda) y la app ya depende de
   ella: `"Mascota"` pasa a devolver sólo las filas propias y todo lo ajeno se
   lee por la vista `mascota_publica`. Correr la app nueva contra una base sin
   la 070 funciona; la 070 sin la app nueva, no (las pantallas de Match y
   Comunidad dejarían de traer mascotas).

   Lección de esta vez: al sacar el bloque 070 de adentro del archivo base
   perdió el `DROP` masivo de políticas que corría más arriba, y chocó contra
   las que reaplica la 066 (`42710: policy already exists`). Si en el futuro se
   mueve SQL de un archivo a otro, correr `probar-esquema.mjs` **antes** de
   pegarlo: eso lo agarra en segundos.
1b. ~~**Pegar la `MIGRACION_071_INTEGRIDAD.sql`**~~ — **hecho el 26/11/2026**
   (con el arreglo de `ReanudadoEn`): anti-trampa
   del paseo con ancla fija, límite de mascotas en la base, mascota principal
   atómica y fecha de mensajes del servidor. **Probada el 26/11/2026**: la
   secuencia completa (base → 071, dos pasadas) y todas las `tests/pruebas_*.sql`
   pasan (sobre PGlite, un Postgres embebido, porque no había `psql` ni Docker).
   En esa prueba se le agregó que `ReanudadoEn` lo fije el reloj del servidor:
   la app lo manda con la hora del teléfono y, con un reloj adelantado, la base
   rechazaba la pausa de un paseo legítimo (y uno atrasado a propósito inflaba
   el cobro). La app desplegada funciona sin ella.
1c. **Redesplegar ZooniVet** (`supabase functions deploy zoonivet-chat`): ahora
   firma cada respuesta y descarta del historial los turnos de assistant sin
   firma válida (no se le pueden inventar respuestas previas), limpia todos
   los campos del contexto y devuelve el cupo si Groq falla. La firma usa la
   service_role como clave; para rotarla aparte:
   `supabase secrets set ZOONIVET_FIRMA_SECRET=<algo largo y aleatorio>`.
   Hasta redesplegarla, la app nueva sigue andando con la función vieja.
2. **ZooniVet** — la función cambió (nombre leído de la base, cupo diario,
   tiempo máximo, CORS por lista de orígenes, errores sin detalles internos):
   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://zooni-mobile.vercel.app
   supabase functions deploy zoonivet-chat
   ```
   Sin `ALLOWED_ORIGINS` el navegador no deja que la app web la llame (en
   nativo no hay CORS, así que ahí anda igual).
3. **Borrar la Edge Function vieja** si alguna vez se desplegó (era un
   oráculo de contraseñas sin límite; ya no está en el repo ni la llama nadie):
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
5. **Dashboard de Supabase** (no se puede hacer desde el SQL):
   - Authentication → Providers → Email → **"Confirm email": activar**
     (hallazgo #21: con la auto-confirmación, un `signUp` con un mail ajeno
     puede quedarse con una cuenta vieja sin migrar).
   - Authentication → Policies → contraseña mínima de 8 caracteres (#76), para
     que no dependa sólo de la app.
   - Database → Extensions → activar `pg_cron` y programar
     `SELECT _purgar_datos_antiguos();` una vez por día (#74: purga
     `PaseoTrack` y `sos_call_logs` viejos).
   - Revisar la restricción por dominio/referrer de la clave de Google Places
     (#150), en Google Cloud Console.
6. **Desplegar la app** (Vercel redespliega solo al pushear).
7. **Probar en la app real, contra la base real.** Nada de abajo se probó
   contra un Supabase de verdad (ver "Cómo se verificó"), y después del merge
   de esta pasada hay dos cosas que conviene mirar primero:
   - **Mascotas ajenas**: Match (candidatos, detalle, chat), Comunidad
     (amigos, buscador, carteles), pacientes de un negocio y mascotas de un
     paseo. Si alguna lista aparece vacía, es que quedó leyendo `"Mascota"` en
     vez de `mascota_publica`.
   - **Paseo completo con pausar/reanudar**: el control anti-trampa de
     `SegundosAcumulados`/`DistanciaMetros` puede ser demasiado estricto si el
     teléfono estuvo sin señal y manda un salto grande al reconectar. El
     margen (+30 s, 15 m/s) está en `_paseo_al_actualizar`, en la 070.
   - Y además: login con cuenta vieja (tiene que pedir cambiar la contraseña
     si la vieja no llega a 8 caracteres), registro, pedido, turno, ZooniVet,
     subir foto, consulta con imagen, chat en vivo con dos sesiones,
     Calendario, Eventos, Tiempo en la app.
   - **CSP**: `vercel.json` ahora manda `Content-Security-Policy`. No se pudo
     probar contra un build real: si algo deja de cargar después de desplegar,
     mirar la consola del navegador por violaciones de CSP y ajustar **esa
     línea** antes que sacar la cabecera entera.

## 2. Decisiones de producto pendientes

- **Veterinarias reales** en `veterinary_clinics`: hoy el SOS muestra las
  líneas de emergencia y la salida a Google Maps, sin lista propia.
- **Verificación de paseadores**: no hay quién verifique. El dueño ve
  "Identidad sin verificar todavía" y puede contratar igual. `verificado` sólo
  lo cambia alguien con acceso al SQL (067).
- **Dos Match con la misma persona** (uno por mascota) son dos chats; se
  distinguen por las mascotas en el nombre. ¿Unificarlos?
- **Mail existente revelado en el registro** (#81): hoy el mensaje es
  explícito ("ya hay una cuenta con este mail"). Volverlo ambiguo mejora la
  privacidad y empeora la UX: es una decisión de producto, no un bug.

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
- Grises `gris50`–`gris400` en `theme/colores.js`: quedaron 5 tonos muy
  parecidos entre sí porque se migraron con un codemod sin tocar un píxel.
  Unificarlos a una escala más corta cambiaría el matiz de fondos y bordes en
  toda la app, y sin un build real no hay forma de verlo: decisión de diseño
  pendiente.

## 4. Deuda que el informe de seguridad dejó anotada

Lo que la auditoría pedía y **no** se resolvió (está al final de la 070, con
el motivo de cada uno): límite de frecuencia general en toda escritura (#38),
firma real del contenido de un archivo subido y no sólo el `contentType`
(#71), nombres de archivo no predecibles (#135–#137), piso de precio por
minuto en solicitudes abiertas de paseo (#119), `search_path` vacío en las
funciones viejas de 000-063 (#100), `EliminarCuentaScreen` que todavía no
llama a ningún servicio (#22).

Dos límites conocidos de lo que **sí** se hizo:
- `negocioApi` y `paseadorApi` perdieron el **peso** y la fecha de nacimiento
  de mascotas ajenas (no están en `mascota_publica`). El precio por tamaño
  sigue bien porque la vista expone `Tamano`; lo que falta es el peso en la
  ficha del paciente. Haría falta una vista aparte para negocio-con-turno y
  paseador-con-paseo.
- El aviso de "cambiá la contraseña" tras migrar una cuenta vieja se da **una
  sola vez**: la 065 borra el hash viejo, así que después no hay forma de
  distinguir esa cuenta. Forzarlo de verdad (bloquear la navegación hasta
  cambiarla) queda pendiente.

## 5. Defensa oral
Repasar `docs/claude/flujos.md` (responde las preguntas de la devolución) y
`docs/claude/base-de-datos.md` (orden de los SQL y qué hace cada migración).

---

## Hecho en esta pasada: merge de las dos ramas

`master` tenía un commit (`dfe98cc`, la auditoría de seguridad de 150
hallazgos) y `origin/master` otros siete (064–068, refactor por tema, datos
inventados afuera). **Los dos lados habían hecho trabajo distinto sobre la
misma base**, así que quedarse con uno destruía la mitad: se mergearon los 49
archivos en conflicto preservando las dos cosas.

**Lo que hubo que decidir, no sólo elegir**
- El bloque `070_endurecimiento_seguridad` vivía **dentro** de
  `SUPABASE_PEGAR_TODO.sql`. Ahí habría corrido *antes* de la 066, que
  restituye las políticas permisivas de base: el endurecimiento quedaba
  deshecho. Pasó a ser `MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql`, que corre
  última, con su guarda ("falta la 068") y su verificación final.
- `_paseo_al_actualizar` estaba redefinida en los dos lados. La versión
  mergeada suma los controles anti-trampa de la 070 **y** el manejo de
  `Id_Mascota = NULL` de la 064 (sin eso, la purga de una mascota rompía el
  paseo que la referenciaba).
- La 070 creaba la tabla `migracion_intentos` y un bucket `fichas-medicas`
  que **ya existían con otra forma** en la 067 y la 064 (`consultas-privadas`).
  Se quitaron los duplicados: su consumidor (la Edge Function `migrar-cuenta`)
  ya no existe, y la app quedó toda sobre `consultas-privadas`.
- `elegirImagen` y `Estrellas` estaban escritos dos veces con APIs distintas.
  Quedó la firma de `origin/master` (la que ya usan los 19 call sites) **con**
  el borrado de EXIF que aportaba el otro lado (#69).
- `debeCambiarContrasena` (#90) lo daba la Edge Function borrada. Ahora sale de
  la RPC `migrar_cuenta_legada` + `esPasswordValida`: si la cuenta se acaba de
  migrar y esa contraseña no cumple la regla de hoy, los tres logins mandan a
  cambiarla.
- El borrado de archivos de Storage (#70) estaba resuelto dos veces: triggers
  en la 068 y `.remove()` del lado de la app. **Quedaron las dos**, a
  propósito: la app lo borra en el momento y los triggers cubren cascadas y
  borrados hechos desde el SQL. Además, así queda tapado el único caso que la
  068 no cubre (`negocio_items.foto`).
- `vercel.json`: las cabeceras de seguridad de un lado + el rewrite que excluye
  `/api/` y la función `api/lugares.js` del otro (si ese rewrite se perdía, la
  API quedaba servida por el `index.html`). La CSP se ajustó: Overpass salió de
  `connect-src` porque el navegador ya no lo llama (va por `/api/lugares`), y
  entró `nominatim.openstreetmap.org`, que sí llama.

**Base**
- `MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql` nueva, con
  `supabase/tests/pruebas_070.sql`: que `"Mascota"` no devuelva filas ajenas,
  que `mascota_publica` no exponga columnas clínicas, que no se pueda insertar
  una notificación a mano, que el paseador no pueda inflar el progreso ni
  aceptar su propio paseo, que no se pueda reseñar un paseo sin finalizar, y
  que lo de la 064–068 siga en pie después de endurecer.
- `SUPABASE_PEGAR_TODO.sql` conserva el arreglo del hallazgo **crítico #1**
  (`completar_perfil_paseador` tomaba `p_id_user` sin compararlo con la sesión
  y estaba otorgada a `anon`) y el #134 (el `ON CONFLICT` volvía a poner
  `public` en los buckets en cada corrida).

**App**
- Lecturas de mascotas ajenas por `mascota_publica` re-aplicadas sobre la
  estructura nueva: `matchApi`, `comunidadApi`, `services/paseador/paseos.js`
  y `resenas.js`, `services/negocio/enriquecer.js`.
- `imagenStorage` quedó con `urlsFirmadas`/`subirImagenPrivada` de un lado y
  `esUrlPropia` + los `borrar*` + el arreglo de la extensión (#125) del otro.
- `zoonivet-chat`: cupo diario y versión exacta de supabase-js de un lado;
  CORS por lista de orígenes, límites de palabra en los disparadores de
  emergencia (#96, "trabajo" ya no dispara por "ajo") y el filtro de dosis
  escritas con palabras ("media pastilla"), del otro.
- `#82` (toggle "Recordar mi mail en este dispositivo") re-aplicado en
  Configuración › Cuenta y seguridad › Sesión.

**Cómo se verificó**
- `npm run lint` y `npm test` en verde (ver el detalle al correrlos).
- **No se pudo verificar acá**, y hay que hacerlo antes de tocar producción:
  - `node supabase/scripts/probar-esquema.mjs` — **no corrió**: esta máquina no
    tiene Postgres local ni Docker. Es la única forma de comprobar que la
    secuencia `base → 064…068 → 070` se aplica dos veces sin romperse y que
    `pruebas_070.sql` pasa. **Correrlo antes de pegar nada en Supabase.**
  - `deno check` de `zoonivet-chat` — no hay `deno` instalado.
  - Recorrido en el navegador contra un Supabase simulado.
