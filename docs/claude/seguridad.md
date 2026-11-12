# Seguridad

← [índice](README.md) · implementación en [base-de-datos](base-de-datos.md) y [servicios](servicios.md) · recorridos en [flujos](flujos.md#login)

## Identidad
- Login: `supabase.auth.signInWithPassword` (bcrypt con sal y costo, del lado de
  Supabase). La sesión (JWT + refresh) la guarda `lib/supabase.js`
  (localStorage en web, SecureStore en trozos en el teléfono).
- Cada consulta viaja con el JWT; la base lo traduce con `usuario_actual()`.
  `config/session.getCurrentUserId()` es sólo una comodidad para armar
  filtros: **no** es prueba de nada.
- Cuentas viejas (SHA-256 en `user_credentials`): la Edge Function
  `migrar-cuenta` las pasa a Auth en el primer login y borra el hash viejo.
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
Buckets `public-images` (5 MB, imágenes), `resenas` (50 MB, imágenes y video,
con cuota de 500 MB por usuario) y `fichas-medicas` (10 MB, privado: imágenes
de consultas veterinarias — se lee con `createSignedUrl`, nunca con una URL
pública). Sólo con sesión y dentro de `<auth uid>/…` (`063`, `070`). El tipo
y tamaño los valida el servidor.

## Notificaciones entre personas
Nunca por `INSERT` directo del cliente en `"Notificacion"` (eso es spam/
phishing abierto). Las crean los triggers/RPC de un evento real (match,
paseo aceptado…) o, para un aviso puntual legítimo, la RPC
`crear_notificacion(destino, mascota, titulo, mensaje, tipo, dataExtra)`, que
exige amistad, match o un trato en común con el destino.

## Auditoría
`auditoria_acciones` (sólo `service_role`) registra altas/activaciones de
negocio y paseador y aceptar un paseo. Se escribe con `_auditar_interno()`
desde dentro de esas mismas funciones.

## Lo que todavía no está
- Límite de mensajes por usuario en ZooniVet.
- Firma real del contenido de un archivo subido (hoy se confía en el
  `contentType` que declara el cliente + lo que el bucket permite).
- Purga programada de `PaseoTrack`/`sos_call_logs` (la función
  `_purgar_datos_antiguos()` existe; falta activar `pg_cron` y programarla).
- Límite de frecuencia general en toda escritura (mensajes, votos, reportes…):
  hoy sólo está donde el informe de seguridad lo pedía puntualmente (turnos,
  pedidos, intentos de `migrar-cuenta`).

Detalle completo de qué se corrigió en la auditoría de nov-2026 y qué quedó
pendiente (y por qué): el bloque final de `SUPABASE_PEGAR_TODO.sql`
(`070_endurecimiento_seguridad`) y [faltaporhacer.md](../../faltaporhacer.md).
