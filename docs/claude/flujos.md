# Flujos de punta a punta

← [índice](README.md) · capas en [arquitectura](arquitectura.md) · código en [servicios](servicios.md) · reglas en [base-de-datos](base-de-datos.md)

Sirven también para las preguntas de la defensa oral.

## Login
`LoginScreen` → `authApi.login` → `iniciarSesionConPassword`:
1. `signInWithPassword(mail, contraseña)` → JWT.
2. Si Auth no conoce la cuenta: Edge Function `migrar-cuenta` (compara con el
   hash viejo, crea el usuario de Auth, borra el hash) y reintenta.
3. `rpc('login_social')` → a qué `User` corresponde (y lo vincula si hace falta).
4. `setCurrentUserId`, modo dueño, primer latido de presencia.
Al abrir la app: `session.restaurarSesion()` hace 3 con la sesión guardada.
Logout: `clearCurrentUserId()` → `auth.signOut({ scope: 'local' })`.

## Registro de dueño
`RegisterStep1–4` → `authApi.registro`: chequeo de mail/@usuario
(`disponibilidad_registro`) → `signUp` → sube la foto a Storage →
`registrar_social_con_mascota` (usuario + mascota + rol en **una transacción**)
→ cierra la sesión y vuelve al login.

## Pedido en un pet shop {#pedidos}
`NegocioPublicoScreen` → `negocioApi.crearPedido` → INSERT en `negocio_pedidos`.
El trigger `_pedido_al_crear` relee precios, calcula subtotal/envío/total y
**reserva el stock** con `SELECT … FOR UPDATE`: si dos piden el último a la vez,
el segundo recibe `sin_stock`. Rechazo o cancelación devuelven el stock
(`_pedido_al_actualizar`, que también valida quién puede mover cada estado).

## Turnos {#turnos}
`ReservarTurnoScreen` → `negocioApi.crearTurno`. `_turno_al_crear` toma un
candado por negocio (`pg_advisory_xact_lock`), rechaza superposiciones
(`horario_ocupado`) y precios que no sean del servicio (`precio_invalido`).

## Paseos
Dueño: `SolicitarPaseoScreen` → `crearSolicitudPaseo` (el precio lo pone
`precio_paseo()` en la base). Paseador: `aceptar_solicitud_paseo` (si dos
aceptan a la vez, gana uno), `en_curso`, `finalizado`. Quién puede mover qué
estado está en la tabla `paseo_transiciones`; al finalizar se fija precio y
comisión una sola vez. Retomar sólo hasta 15 min después.

## Match
`MatchScreen` → `matchApi.postMatchLike` → `rpc('votar_mascota')`: guarda el voto
y, si hay like recíproco, crea el Match (una vez, par ordenado) y notifica a los
dos, todo en una transacción.

## ZooniVet
`VirtualVetScreen` → `zoonivetApi.preguntarZooniVet` → Edge Function
`zoonivet-chat` (con JWT): verifica que la mascota sea tuya, arma el contexto con
`get_pet_chat_context`, detecta emergencias, llama a Groq con la clave secreta y
filtra la salida. Si la función no está: `SERVICIO_NO_DISPONIBLE`.

## Chats
Se actualizan consultando cada `INTERVALO_CHAT_MS` (4 s) con la pantalla abierta
(`constants/intervalos.js`). Pasar a Supabase Realtime está en [faltaporhacer](../../faltaporhacer.md).
