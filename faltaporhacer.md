# Falta por hacer

Actualizado el **26/11/2026**. Lo pendiente, por prioridad; lo hecho hoy, al
final.

## 1. Urgente

1. **Borrar la secret key expuesta.** La secret key `default` quedó a la vista en capturas de pantalla. Supabase → Project Settings →
   API Keys → Secret keys → **⋮ → borrar**. Ni la app ni ZooniVet la usan;
   si un script necesita una, se crea otra con "New secret key". Borrar
   también las capturas guardadas en Imágenes → Capturas de pantalla.

## 2. Para terminar de poner en producción

1. **Comprobar la consulta 6** (la única imagen que se mudó al bucket
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
2. **Dashboard de Supabase** (no se puede hacer desde el SQL):
   - Authentication → Providers → Email → **"Confirm email": activar** (#21:
     sin eso, un `signUp` con un mail ajeno puede quedarse con una cuenta
     vieja sin migrar).
   - Authentication → Policies → **contraseña mínima de 8** (#76).
   - Database → Extensions → activar **`pg_cron`** y programar
     `SELECT _purgar_datos_antiguos();` una vez por día (#74: purga
     `PaseoTrack` y `sos_call_logs` viejos).
   - Google Cloud Console: restringir por dominio la clave de Google Places
     (#150).
3. **Probar en la app real** (https://zooni-mobile.vercel.app y en el
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
   - Login con cuenta vieja (pide cambiar la contraseña si no llega a 8),
     registro, pedido, turno, subir foto, consulta con imagen, chat en vivo
     con dos sesiones, Calendario, Eventos, Tiempo en la app.
   - **CSP** (`vercel.json`): si algo no carga en la web, F12 → consola →
     buscar "Content-Security-Policy" y ajustar **esa línea**, no sacar la
     cabecera entera.
   - iOS y Android (hasta ahora todo se probó en la web).

## 3. Decisiones de producto

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

No resuelto (detallado al final de la 070): límite de frecuencia en toda
escritura (#38), verificar el contenido real de un archivo subido y no sólo
el `contentType` (#71), nombres de archivo no predecibles (#135–#137), piso
de precio por minuto en solicitudes abiertas de paseo (#119), `search_path`
vacío en las funciones viejas de 000–063 (#100), `EliminarCuentaScreen` que
no llama a ningún servicio (#22).

Límites conocidos de lo que sí se hizo:
- Negocios y paseadores no ven el **peso** ni la fecha de nacimiento de
  mascotas ajenas (no están en `mascota_publica`). Haría falta una vista para
  negocio-con-turno y paseador-con-paseo.
- El aviso de "cambiá la contraseña" tras migrar una cuenta vieja sale **una
  sola vez** (la 065 borra el hash viejo). Forzarlo de verdad queda pendiente.

## 6. Defensa oral

Repasar `docs/claude/flujos.md` y `docs/claude/base-de-datos.md`.

---

## Referencia

**Orden de la base** (para una base nueva): `SUPABASE_PEGAR_TODO.sql` y
después, cada uno entero, `MIGRACION_064…`, `065`, `066`, `067`, `068`,
`070`, `071`. Cada uno verifica el anterior y es idempotente. La 070 va
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

## Hecho el 26/11/2026

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
