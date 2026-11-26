# Seguridad

← [índice](README.md) · implementación en [base-de-datos](base-de-datos.md) y [servicios](servicios.md) · recorridos en [flujos](flujos.md#login)

## Identidad
- Login: `supabase.auth.signInWithPassword` (bcrypt con sal y costo, del lado de
  Supabase). La sesión (JWT + refresh) la guarda `lib/supabase.js`
  (localStorage en web, SecureStore en trozos en el teléfono).
- Cada consulta viaja con el JWT; la base lo traduce con `usuario_actual()`.
  `config/session.getCurrentUserId()` es sólo una comodidad para armar
  filtros: **no** es prueba de nada.
- Cuentas viejas (SHA-256 en `user_credentials`): la función de la base
  `migrar_cuenta_legada` (065) las pasa a Auth en el primer login y borra el
  hash viejo (ver "Cuentas viejas" abajo).
  Un `signUp` con el mail de una cuenta vieja **no** se vincula a ella
  (`login_social` lanza `cuenta_sin_migrar`).

## Autorización (RLS, `061`)
- `anon` sólo lee catálogos. Todo lo demás pide sesión.
- Salud (vacunas, tratamientos, consultas, peso, eventos): sólo el dueño.
- `User`: sólo la fila propia. De otros, `perfil_publico` (sin mail, edad en vez
  de fecha, ubicación a ~1 km, teléfono sólo con trato en común).
- Match sólo lo crea `votar_mascota`; pedidos/turnos/paseos validados por trigger.

## Secretos
- Todo `EXPO_PUBLIC_*` es público (va en el bundle): URL y clave publicable de
  Supabase, clave de Google Places (restringida por dominio).
- Secretos sólo en Edge Functions: `GROQ_API_KEY`; `SUPABASE_SERVICE_ROLE_KEY`
  la inyecta Supabase. Ver `supabase/functions/.env.example`.

## Storage
Buckets `public-images` (5 MB, imágenes) y `resenas` (50 MB, imágenes y
video). Sólo con sesión y dentro de `<auth uid>/…` (`063`). El tamaño y la
lista de tipos los valida el bucket.

Antes de subir, `services/imagenStorage` mira los **bytes** del archivo
(`utils/tipoDeArchivo.tipoReal`): sólo sube JPEG/PNG/WebP/GIF/HEIC (y video
en `resenas`), con el tipo que dicen los bytes, no la extensión ni el mime
del picker (#71). El nombre son 128 bits al azar (`nombreAlAzar`, #135–#137).
Límite: es un control de la app; quien use la API de Storage directo con su
token se lo saltea (frena el bucket).

`consultas-privadas` (064, 10 MB, imágenes) **no es público**: sólo el dueño de
la carpeta lee, sube y borra. En la tabla se guarda la ruta (`imagen_path`) y
la app pide una URL firmada de 1 hora para mostrarla.

## Baja de la cuenta (072)
`EliminarCuentaScreen` → `authApi.solicitarBajaDeCuenta`: comprueba la
contraseña (si la cuenta tiene) y llama a `solicitar_eliminacion_cuenta`.
`deletion_requests` no se escribe desde la app (con INSERT directo alguien se
saltearía los 30 días). Durante el plazo `perfil_publico`, `mascota_publica` y
`mascota_de_cliente` ocultan la cuenta; iniciar sesión la recupera
(`login_social` → `bajaCancelada`). Vencido el plazo,
`purgar_cuentas_eliminadas()` borra lo que es sólo de la persona, cierra su
negocio, anonimiza la fila de `"User"` (no la borra: paseos, pagos, turnos y
opiniones son también de la otra parte), borra su usuario de Auth y anota sus
archivos para `limpiar-storage.mjs`.

## Cuentas viejas
La primera vez que entra una cuenta de antes de 060, `authApi` llama a
`migrar_cuenta_legada` (065): compara el sha256 viejo, crea el usuario de Auth
con esa contraseña (bcrypt), vincula `"User".auth_id` y borra el hash. Responde
lo mismo si el mail no existe o la contraseña es mala, y frena después de 5
fallos en 15 minutos por mail (067). Si la contraseña heredada tiene menos de
8 caracteres, queda `"User".DebeCambiarContrasena` (072) y cada login manda a
"Cambiar contraseña" hasta que se cambie.

Ya no hay otro camino: la Edge Function `migrar-cuenta` (sin verificar JWT y
sin límite de intentos: un oráculo de contraseñas) y el login viejo de la app
(`authLegado.js`, que mandaba el SHA-256 y entraba sin JWT) se eliminaron, y la
068 borra las RPC del login con hash (`login_user`, `registrar_*`/`activar_*`
con `p_hash`, `cambiar_contrasena`). Si la base no responde durante el login,
la app dice "no se pudo conectar", no "contraseña incorrecta".

## Archivos que quedan sin uso (068)
Al borrar una mascota, una foto suya o una consulta (o reemplazar una foto),
un trigger anota el archivo en `archivos_por_borrar` (sólo service_role). La
base no puede borrar archivos de Storage (Supabase no lo permite con SQL), así
que lo hace `supabase/scripts/limpiar-storage.mjs` con la clave service_role
desde una máquina del equipo; antes de borrar, `archivos_para_borrar()`
descarta lo que todavía use alguna fila. El mismo script muda las imágenes de
consultas cargadas antes de la 064 del bucket público al privado.

## ZooniVet
Cupo diario por usuario contado en la base (`zoonivet_uso`, sólo service_role).
La Edge Function lo consume antes de llamar a Groq.

## Funciones (067)
Supabase le da EXECUTE a `anon` y `authenticated` en toda función nueva de
`public`. Por eso un `REVOKE … FROM anon, public` NO alcanza: el usuario
logueado la sigue pudiendo llamar (pasó con `_upsert_paseador_perfil` y
`_upsert_negocio`, que dejaban reescribir perfiles ajenos).

Regla: las funciones `SECURITY DEFINER` están cerradas por **lista blanca**
(sección 067). Si agregás una RPC que la app tiene que llamar, sumala a
`para_usuarios` (o `para_anon` si se usa sin sesión) y volvé a correr la 067.
Las funciones nuevas arrancan cerradas para `anon`.

`migrar_cuenta_legada` (sin sesión) frena después de 5 fallos por mail en 15
minutos (`migracion_intentos`). `verificado` (paseadores) y `verified`
(servicios) sólo cambian desde el SQL Editor / service_role.

## Mascotas de otras personas (070)
`"Mascota"` ya **sólo devuelve las filas propias**. Lo ajeno (Match, Comunidad,
pacientes de un negocio, mascotas de un paseo) se lee por la vista
**`mascota_publica`**, que deja afuera lo clínico (`EstadoSalud`, `ChipId`,
`Microchip`, `SenasParticulares`, el ciclo de vida) y, en lugar de
`FechaNacimiento` y `Peso`, expone `EdadAnios` ya calculada y `Tamano`. La
vista además filtra `Estado = 'active'` y a quien te bloqueó.

Peso y fecha de nacimiento, para quien atiende a la mascota: la vista
**`mascota_de_cliente`** (072) los da sólo al paseador de un paseo aceptado o
en curso y al negocio con un turno pendiente, confirmado o completado
(`services/mascotasDeClientes`).

Si una pantalla deja de traer mascotas ajenas, es casi siempre esto: está
leyendo `"Mascota"` en vez de la vista.

Las notificaciones a otra persona no se insertan: van por
`rpc('crear_notificacion', …)`, que exige match / amistad / trato con el
destino (`services/comun.js` la llama y se traga el error, para no cortar el
flujo si no hay relación).

## Riesgos conocidos que quedan
- `paseador_perfil.lat/lng` se ven exactos (el mapa los usa): conviene
  redondearlos o que el paseador marque un punto de zona, no su casa. Los de
  `"User"` sí se redondean a 2 decimales (trigger de la 070 + `perfil_publico`).
- `disponibilidad_registro` dice si un mail ya está registrado (lo necesita
  el registro).
- El tipo real de un archivo se comprueba en la app (ver Storage), no en el
  servidor: haría falta un webhook de Storage que lea cada archivo.
- Límite de frecuencia general en toda escritura (mensajes, votos, reportes…):
  hoy sólo está donde el informe lo pedía puntualmente (turnos, pedidos,
  intentos de `migrar_cuenta_legada`, cupo de ZooniVet).
- Purgas programadas (`PaseoTrack`/`sos_call_logs` viejos, mascotas y
  cuentas dadas de baja): `_purgar_datos_antiguos()` las hace todas; falta
  activar `pg_cron` y programarla. Hasta entonces, una cuenta dada de baja
  queda oculta pero sin purgar.

Detalle completo de qué se corrigió en la auditoría de nov-2026 y qué quedó
pendiente (y por qué): el final de
`supabase/MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql` y
[faltaporhacer.md](../../faltaporhacer.md).
