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

## Lo que todavía no está
Bucket privado para imágenes de consultas, límite de mensajes por usuario en
ZooniVet: [pendientes.md](pendientes.md).
