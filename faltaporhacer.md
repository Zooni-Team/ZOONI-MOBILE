# Falta por hacer

Actualizado el **26/11/2026**. Lo pendiente, por prioridad; lo hecho hoy, al
final.

## 1. Urgente

Nada. (✔ 26/11: la secret key `default` expuesta en capturas se borró en
Supabase, y las capturas también. Si un script necesita una, se crea otra
con "New secret key".)

## 2. Para terminar de poner en producción

0. **ZooniVet da `net::ERR_FAILED` en la web** (27/11): la respuesta llega sin
   CORS. Revisar en Edge Functions → `zoonivet-chat`: que esté desplegada,
   sus **Logs**, el secret `ALLOWED_ORIGINS=https://zooni-mobile.vercel.app`
   y que `GROQ_API_KEY` siga cargado. Después **redesplegar** `index.ts`: ahora
   un error inesperado responde con CORS (`ERROR_INTERNO`) y queda en los Logs.

0. **Push del commit `0151218`** (072 en la app: baja de cuenta, fotos por
   bytes, peso para paseador/negocio). Hasta el push, Vercel sirve la versión
   anterior; la base ya tiene la 072 y la app vieja anda igual con ella.
   Opcional: ver correr el cron (`cron.alter_job(1, schedule := '* * * * *')`,
   mirar `cron.job_run_details`, y volverlo a `'30 3 * * *'`).

1. ✔ **`MIGRACION_072` aplicada en producción** (26/11; verificado con
   `to_regprocedure('public.purgar_cuentas_eliminadas()')`).
2. **Comprobar la consulta 6** (la única imagen que se mudó al bucket
   privado). Sólo la ve su dueño. Para saber de quién es, en el SQL Editor:
   ```sql
   SELECT c.id AS consulta, m."Nombre" AS mascota, u."Mail" AS dueno
   FROM consultas_veterinarias c
   JOIN "Mascota" m ON m."Id_Mascota" = c.mascota_id
   JOIN "User" u ON u."Id_User" = m."Id_User"
   WHERE c.id = 6;
   ```
   Entrar con esa cuenta → menú ☰ → Ficha Médica → "Consultas veterinarias"
   y ver que la imagen cargue. Si no, F12 → consola → copiar el error.
   (Opcional: el script ya verificó la subida antes de borrar la pública.)
3. **Dashboard de Supabase** (no se puede hacer desde el SQL):
   - Authentication → Providers → Email → **"Confirm email": activar** (#21:
     sin eso, un `signUp` con un mail ajeno puede quedarse con una cuenta
     vieja sin migrar).
   - Authentication → Policies → **contraseña mínima de 8** (#76).
   - ✔ **`pg_cron` activo** (26/11): job `zooni_purgas_diarias`, todos los
     días 03:30 UTC → `SELECT public._purgar_datos_antiguos()` (`PaseoTrack` y
     `sos_call_logs` viejos, mascotas y cuentas dadas de baja hace 30 días).
     Ver que corra: `SELECT status, return_message, start_time FROM
     cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
   - Google Cloud Console: restringir por dominio la clave de Google Places
     (#150).
4. **Probar en la app real** (https://zooni-mobile.vercel.app y en el
   celular). Primero:
   - **Paseo completo: iniciar → pausar → reanudar → finalizar.** Es lo que
     cambió la 071. Si aparece "progreso inválido" en un paseo normal, el
     margen (+30 s, 15 m/s) se afloja en `_paseo_al_actualizar` (071).
   - **Mascotas ajenas**: Match, Comunidad (amigos, buscador, carteles),
     pacientes de un negocio, mascotas de un paseo. Una lista vacía = quedó
     leyendo `"Mascota"` en vez de `mascota_publica`.
   - **Marcar mascota principal** y el **límite de 10 mascotas** (ahora en la
     base, 071).
   - **ZooniVet** desde la web, con sesión iniciada (CORS ya verificado; falta
     ver una respuesta real, que confirma `GROQ_API_KEY`).
   - **Eliminar mi cuenta** (072) con una cuenta de prueba: pide la
     contraseña (no a una cuenta de Google), cierra sesión, otra cuenta ya no
     la ve en Comunidad/Match; volver a entrar avisa "Recuperaste tu cuenta".
   - **Subir fotos** desde el iPhone y desde Android (perfil, mascota,
     cartel, consulta, reseña con video): ahora se mira el contenido real del
     archivo. Si alguna falla con "archivo_invalido", anotar qué formato era.
   - Paseador con un paseo aceptado y veterinaria con un turno: la tarjeta
     del paseo y la ficha del paciente muestran el **peso** (072).
   - Login con cuenta vieja (pide cambiar la contraseña si no llega a 8, y
     lo sigue pidiendo en cada login hasta cambiarla),
     registro, pedido, turno, subir foto, consulta con imagen, chat en vivo
     con dos sesiones, Calendario, Eventos, Tiempo en la app.
   - **CSP** (`vercel.json`): si algo no carga en la web, F12 → consola →
     buscar "Content-Security-Policy" y ajustar **esa línea**, no sacar la
     cabecera entera.
   - iOS y Android (hasta ahora todo se probó en la web).

## 3. Decisiones de producto

- **Piso de precio por minuto** en solicitudes abiertas de paseo (#119):
  hace falta decidir la tarifa mínima; después es un CHECK en el trigger.
- **Veterinarias reales** en `veterinary_clinics`: hoy el SOS muestra líneas
  de emergencia y la salida a Google Maps, sin lista propia.
- **Verificación de paseadores**: nadie verifica. El dueño ve "Identidad sin
  verificar todavía" y puede contratar igual; `verificado` sólo se cambia
  desde el SQL (067).
- **Dos Match con la misma persona** (uno por mascota) son dos chats. ¿Unificar?
- **Mail existente revelado en el registro** (#81): mensaje explícito hoy.
  Ambiguo = más privacidad, peor UX.

## 4. Código

- **Modo oscuro**: no existe ("Próximamente" en Configuración › Tema). Es
  viable (todos los colores salen de `theme/colores.js`), falta diseñar la
  paleta y revisar pantalla por pantalla.
- **Pantallas grandes** (500–850 líneas): `NegocioPublicoScreen`,
  `MisMascotasScreen`, `ClosetScreen`, `PerfilScreen`, `SosScreen`,
  `ComunidadScreen`, `FichaMedicaScreen`. Mismo método que Home o Calendario:
  datos a un hook, piezas a `components/<tema>/`.
- **Grises `gris50`–`gris400`**: 5 tonos casi iguales. Unificarlos cambia
  fondos y bordes en toda la app: decisión de diseño, verla en un build real.

## 5. Deuda del informe de seguridad

No resuelto: **límite de frecuencia en toda escritura** (#38). Hoy está sólo
donde el informe lo pedía (turnos, pedidos, login de cuentas viejas,
ZooniVet). Hacerlo general necesita decidir topes por tabla, o un proxy
delante de PostgREST.

Límites conocidos de lo que sí se hizo:
- El tipo real de un archivo (#71) se comprueba **en la app**, por sus
  bytes. Quien use la API de Storage directo con su token se lo saltea
  (frena el bucket: tamaño y lista de tipos). Del lado del servidor haría
  falta un webhook de Storage.
- Las RPC de la 070–072 (`crear_notificacion`, `marcar_mascota_principal`,
  `solicitar_eliminacion_cuenta`…) ahora están en la lista blanca de la 067:
  volver a pegar sólo la 067 ya no las cierra.
- Los archivos que ya estaban en Storage conservan su nombre viejo
  (`<timestamp>-<n>`); sólo los nuevos son al azar.

## 6. Defensa oral

Repasar `docs/claude/flujos.md` y `docs/claude/base-de-datos.md`.

---

## Referencia

**Orden de la base** (para una base nueva): `SUPABASE_PEGAR_TODO.sql` y
después, cada uno entero, `MIGRACION_064…`, `065`, `066`, `067`, `068`,
`070`, `071`, `072`. Cada uno verifica el anterior y es idempotente. La 070 va
después de la 066 a propósito (la 066 reaplica políticas permisivas que la
070 endurece). Si se mueve SQL de un archivo a otro, correr
`node supabase/scripts/probar-esquema.mjs` **antes** de pegarlo.

**Limpiar Storage** (repetir cada tanto; las mascotas purgadas dejan
archivos). PowerShell, desde la raíz del repo:
```powershell
$env:SUPABASE_URL = "https://nvbddhfdkbhgxrpxdoez.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<secret key sb_secret_… o service_role legacy>"
node --use-system-ca supabase/scripts/limpiar-storage.mjs            # prueba
node --use-system-ca supabase/scripts/limpiar-storage.mjs --aplicar  # lo hace
```
`--use-system-ca` hace falta en la red de la oficina, que inspecciona HTTPS
(sin eso: `fetch failed` / `SELF_SIGNED_CERT_IN_CHAIN`). En CMD las variables
van con `set NOMBRE=valor`, sin comillas.

**ZooniVet**: secrets `GROQ_API_KEY` y
`ALLOWED_ORIGINS=https://zooni-mobile.vercel.app` (sin barra final; para
probar en local, agregar `,http://localhost:8081`). Se despliega pegando
`supabase/functions/zoonivet-chat/index.ts` en Edge Functions → Code →
Deploy.

---

## Hecho el 26/11/2026 (noche)

- **Configuración honesta**: cartel "Vista previa" en lo que se ve pero no
  funciona (Notificaciones, Suscripciones, Ayuda, gran parte de Privacidad y
  de Medios) y etiqueta en el índice. Fuera los datos inventados (8 permisos
  con estados falsos, caché de 248 MB, tarjeta •••• 4242, "2 pendientes",
  "Todo funcionando", versión 1.4.2, "te enviamos tus datos por mail").
- **Ahora funciona de verdad**: estado real de los permisos, calidad de
  subida de fotos, cantidad de bloqueados + desbloquear, quitar la foto de
  perfil (y la vieja se borra de Storage al cambiarla).
- **Sin comentarios en el código** (288 archivos, JS y SQL). La base se
  probó igual desde cero después del borrado. Lint quedó con 0 errores y 17
  avisos de hooks (antes silenciados con `eslint-disable`). La explicación
  vieja de cada archivo sigue en git: `git show 9da681e:<archivo>`.

## Hecho el 26/11/2026 (tarde)

- **MIGRACION_072** (probada desde cero, dos pasadas + `pruebas_072.sql`; la
  prueba se saboteó a propósito para confirmar que de verdad corre):
  - **Eliminar mi cuenta** (#22): la pantalla ahora pide la baja de verdad
    (antes no llamaba a nada y el `Alert` con botones no andaba en web).
    30 días oculta, entrar la recupera, después se anonimiza.
  - **Contraseña débil heredada** se pide en cada login hasta cambiarla.
  - **Peso y nacimiento** para el paseador / negocio que atiende a la mascota
    (vista `mascota_de_cliente`).
  - **`search_path`** fijo en las 6 funciones que no lo tenían (#100).
- **Storage**: tipo real por los bytes (#71) y nombres al azar de 128 bits
  (#135–#137). La subida de reseñas ahora dice "muy pesado" cuando el archivo
  se rechaza en la app (antes caía en el genérico).
- **Bug**: `login()` perdía `debeCambiarContrasena`; el login de dueños nunca
  mandaba a cambiar la contraseña débil (#90).
- `completar_perfil_paseador` / `aceptar_solicitud_paseo` ya no reciben un id
  armado en el cliente (la base lo ignoraba).
- Lint 0, `npm test` 72/72.

## Hecho el 26/11/2026 (mañana)

- **Verificación completa**: lint 0 errores, `npm test` 62/62, build web
  (`expo export`) sin errores, cruce app ↔ base (las 47 tablas/vistas, 16 RPCs
  y 3 buckets que usa la app existen en el SQL; las 59 pantallas a las que se
  navega están registradas).
- **Esquema probado desde cero por primera vez**: base → 071 dos veces y las 8
  `tests/pruebas_*.sql`, sobre PGlite (Postgres embebido; no había `psql` ni
  Docker).
- **Pruebas SQL arregladas**: `pruebas_rls` reusaba la sesión de Ana para otra
  cuenta; `pruebas_070`/`071` "aceptaban" el paseo con un UPDATE que tocaba 0
  filas, así que el anti-trampa no se probaba; `pruebas_066` esperaba un
  mensaje de error viejo.
- **071 corregida y aplicada en producción**: `ReanudadoEn` lo fija el reloj
  del servidor (con el teléfono adelantado se rechazaban pausas legítimas; con
  uno atrasado a propósito se inflaba el cobro).
- **ZooniVet redesplegado** con `ALLOWED_ORIGINS`. Verificado: el dominio
  recibe CORS, otro sitio no, sin sesión da 401.
- **`migrar-cuenta`**: verificado que nunca se desplegó.
- **Storage limpio**: 1 imagen de consulta mudada al bucket privado, su copia
  pública borrada, 0 huérfanos. `limpiar-storage.mjs` ahora acepta la secret
  key nueva (`sb_secret_…`), no sólo la `service_role` legacy que se retira en
  2027.
- **Firma del historial de ZooniVet** (#43) en producción: ya no se pueden
  inventar respuestas previas del asistente.
- Borrados 5 componentes sin uso (reemplazados por `HeroMascota`,
  `salud/Tarjeta*`, `ui/CampoFormulario`).
