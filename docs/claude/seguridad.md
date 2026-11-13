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
Buckets `public-images` (5 MB, imágenes) y `resenas` (50 MB, imágenes y
video). Sólo con sesión y dentro de `<auth uid>/…` (`063`). El tipo y tamaño
los valida el servidor.

`consultas-privadas` (064, 10 MB, imágenes) **no es público**: sólo el dueño de
la carpeta lee, sube y borra. En la tabla se guarda la ruta (`imagen_path`) y
la app pide una URL firmada de 1 hora para mostrarla.

## Cuentas viejas
La primera vez que entra una cuenta de antes de 060, `authApi` llama a
`migrar_cuenta_legada` (065): compara el sha256 viejo, crea el usuario de Auth
con esa contraseña (bcrypt), vincula `"User".auth_id` y borra el hash. Responde
lo mismo si el mail no existe o la contraseña es mala. La Edge Function
`migrar-cuenta` queda sólo como respaldo para bases sin 065.

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

## Riesgos conocidos que quedan
- Cualquiera con sesión puede crear una notificación para otro usuario
  (`notif_crear`): sirve para avisos legítimos, pero también para spam.
- `paseador_perfil.lat/lng` se ven exactos (el mapa los usa): conviene
  redondearlos o que el paseador marque un punto de zona, no su casa.
- `disponibilidad_registro` dice si un mail ya está registrado (lo necesita
  el registro).
- `Mascota` se lee completa entre usuarios (fecha de nacimiento, microchip si
  está cargado).
