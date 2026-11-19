# Flujos de punta a punta

← [índice](README.md) · capas en [arquitectura](arquitectura.md) · código en [servicios](servicios.md) · reglas en [base-de-datos](base-de-datos.md)

Sirven también para las preguntas de la defensa oral.

## Login
`LoginScreen` → `authApi.login` → `iniciarSesionConPassword`:
1. `signInWithPassword(mail, contraseña)` → JWT.
2. Si Auth no conoce la cuenta: `rpc('migrar_cuenta_legada')` (065: compara
   con el hash viejo, crea el usuario de Auth, borra el hash; 067: máximo 5
   fallos cada 15 min) y reintenta. Si la base no responde, el error es de
   conexión, nunca "contraseña incorrecta".
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
filtra la salida. Si la función no está: `SERVICIO_NO_DISPONIBLE`. Antes de
llamar a Groq descuenta un mensaje del cupo diario del usuario
(`zoonivet_consumir_cupo`, 064; secret `ZOONIVET_LIMITE_DIARIO`, 40 por
defecto); sin cupo responde 429 `CUPO_AGOTADO`.

## Chats
Llegan por **Supabase Realtime**: `hooks/useRecargaEnVivo(cargar, { tabla, filtro })`
se suscribe (vía `services/tiempoReal.escucharCambios`) mientras la pantalla está
en foco y vuelve a llamar a `cargar` con cada cambio. `Mensaje` y `paseo_mensajes`
están en la publicación `supabase_realtime` (064) y Realtime respeta RLS. Como red
de seguridad, también consulta cada `INTERVALO_CHAT_RESPALDO_MS` (30 s).

## Subir una foto
`utils/elegirImagen` (permiso + recorte) → `services/imagenStorage`:
- Fotos comunes (mascota, perfil, negocio): `subirImagenPublica` →
  bucket `public-images`, carpeta `<auth uid>/<tema>/`. Storage (063) sólo
  deja escribir en la carpeta propia, imágenes de hasta 5 MB.
- Estudios y recetas de una consulta: `subirImagenPrivada` → bucket
  `consultas-privadas` (064). Se guarda la ruta y se muestra con una URL
  firmada que vence en 1 hora: sin sesión del dueño, no se ve.
- Cuando la foto deja de usarse (se borra la mascota, la foto o la consulta,
  o se reemplaza), la 068 la anota y `limpiar-storage.mjs` la borra.

## Borrar una mascota
`EliminarMascotaScreen` → `petsApi`: **borrado lógico** (`Estado = 'deleted'`,
`PurgarDespues` = +30 días), así se puede recuperar. Pasado el plazo,
`purgar_mascotas_eliminadas()` (064, cada noche con pg_cron) la borra de
verdad. Es una decisión, escrita en la base: lo que no tiene sentido sin la
mascota se va con ella (`CASCADE`: salud, votos, matches, fotos, calendario);
lo que tiene valor propio queda con la mascota en `NULL` (`SET NULL`:
publicaciones, carteles, turnos, y paseos, para no perder lo que cobró el
paseador). Sus archivos quedan anotados para borrar (068).

## Tiempo en la app
`App.jsx` → `services/usoApp`: se mide sólo con la app en primer plano y con
sesión; cada 5 minutos (y al irse al fondo) se suma a `app_usage_daily` (una
fila por persona y día, RLS: sólo la propia). Configuración › Tiempo en la app
lee los últimos 7 días. Los avisos de límite y descanso son locales y nunca
bloquean (bloquear podría dejar a alguien sin llegar al SOS).
