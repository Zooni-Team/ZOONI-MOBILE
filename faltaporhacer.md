# Falta por hacer

Estado al cortar la refactorización. Ordenado por prioridad.

## 1. Para que lo hecho funcione (hacerlo YA, en este orden)
1. **Desplegar las Edge Functions** (si no, las cuentas viejas no pueden entrar
   después del paso 2):
   ```bash
   supabase login
   supabase link --project-ref <ref-del-proyecto>
   supabase functions deploy migrar-cuenta --no-verify-jwt
   supabase secrets set GROQ_API_KEY=gsk_...
   supabase functions deploy zoonivet-chat
   ```
2. **Pegar `supabase/SUPABASE_PEGAR_TODO.sql` entero** en Supabase → SQL Editor → Run.
3. Authentication → Providers → Email: habilitado (decidir "Confirm email", ver README).
4. Cargar en Vercel las variables de `zooni-app/.env.example` y redesplegar.
5. Probar en la app real: login con cuenta vieja, registro, Match (like
   recíproco), pedido en pet shop, turno, paseo completo, ZooniVet, subir foto.
   Nada de esto se probó contra la base real (sólo contra Postgres local y
   dobles de prueba).
6. Cuando `select count(*) from user_credentials` dé 0: borrar
   `zooni-app/src/services/authLegado.js`, su uso en `authApi.js` y
   `consultaRespaldo` en `services/perfilesPublicos.js`.

## 2. Refactor pendiente (código)
- ~~Elegir fotos repetido en 18 archivos~~ — hecho: `utils/elegirImagen.js`
  (`elegirImagen`, `elegirMultimedia`), reemplazado en los 18 archivos. De
  paso quita el EXIF (GPS) de cada foto antes de subirla (informe #69).
- ~~Componentes casi iguales a unificar~~ — hecho, salvo uno (ver abajo):
  - `fichaMedica/CardAplicado.jsx` y `CardSugerido.jsx` (Vacunas y
    Tratamientos): reciben el `styles` de la pantalla y los datos ya
    formateados; `CardSugerido` tiene dos layouts (`"simple"`/`"detallado"`).
  - `ui/Campo.jsx` e `ui/InputPassword.jsx` (registros de Negocio y
    Paseador).
  - `ui/Estrellas.jsx` (lectura, con medias estrellas) y su export
    `EstrellasInput` (para elegir tocando) — unificó 4 definiciones
    (`resenas/ResenasPaseadorModal`, `Paseador/tabs/PerfilTab`,
    `MisPaseosScreen`, `resenas/CalificarPaseoModal`).
  - `ui/EspecieTile.jsx` (RegisterStep1 y AltaMascota — ya decía en un
    comentario "igual que en RegisterStep1", eran bit a bit iguales).
  - `ui/PetIllustration.jsx` (Home y FichaMedica) — Home pide sombra
    (`sombra`, con sus variantes web/iOS) y FichaMedica no (default).
  - **`EventoCard` (Calendario y Eventos): NO se unificó a propósito.**
    Después de leer las dos, no son "casi iguales": la de Calendario es un
    ítem compacto de agenda personal (editar/eliminar, color por
    proximidad); la de Eventos es una tarjeta de evento público de la
    comunidad (foto, categoría, botón "Agregar al calendario", abre Google
    Maps, descripción expandible). Forzarlas a un solo componente hubiera
    significado un componente con un `if` gigante y props que no se pisan
    en nada real — más acoplamiento, no menos. Quedan como están.
  `npm run lint` y `npm test` quedaron en verde después de este cambio.
- ~~7 avisos de ESLint~~ (`react-hooks/exhaustive-deps`) — hecho: `cargarDatos`
  (Closet, Eventos) y `animarHero` (Consultas, Tratamientos) en `useCallback`,
  movidos antes del `useEffect`/`useCallback` que los usa; `onChatsSinLeer`
  (PaseadorHeader) por un ref, igual que `contarChats`, para no reiniciar el
  intervalo de 30 s cada vez que el padre pasa una función nueva;
  `valueFromX`/`updateFromX` (sliders de Match) en `useCallback`. `npm run
  lint` da 0 avisos.
- Smoke test en el navegador: se probó login y registro paso 1–2 (FechaPicker);
  falta recorrer el resto de pantallas con una base real.
- Pantallas gigantes (SRP): `EventosScreen`, `CalendarioScreen`, `HomeScreen`,
  `TratamientosScreen`, `VacunasScreen` (800–1000 líneas): separar
  subcomponentes en archivos y la carga de datos en hooks.
- `services/paseadorApi.js` (~1.500 líneas) y `negocioApi.js` (~1.200): partir
  por tema (perfil, solicitudes, pagos, reseñas, chat / catálogo, turnos, pedidos).

## 3. Diseño
- Grises `gris50`–`gris600` en `src/theme/colores.js`: **ya están definidos**
  (8 tonos entre `#F5F5F5` y `#D8D8D8`), pero son casi idénticos entre sí
  porque se migraron con un codemod sin tocar un píxel — **no** se tocaron en
  esta pasada: unificarlos a una escala realmente corta cambiaría el matiz
  exacto de fondos/bordes en toda la app sin forma de verlo acá (sin
  dispositivo/build real), así que sigue siendo la decisión de diseño
  pendiente que ya marcaba este archivo (ver `docs/claude/estilos.md`).
- Modo oscuro: no existe.

## 4. Base y seguridad

**Auditoría de seguridad de nov-2026** (`INFORME_SEGURIDAD_ZOONI.md`, 150
hallazgos): la mayoría de los de RLS/RPC/Edge Functions/Storage se corrigieron
en `supabase/SUPABASE_PEGAR_TODO.sql` sección `070_endurecimiento_seguridad`
(pegarla entera en Supabase → SQL Editor → Run) y en las dos Edge Functions.
Lo que **falta para que esos arreglos funcionen de punta a punta**, por orden:

1. ~~App — leer mascotas de otras personas desde `mascota_publica`~~ — hecho:
   `api/comunidad` (amigos, búsqueda, carteles), `matchApi` (candidatos,
   detalle de match, tarjeta propia — ésta sigue por "Mascota" porque es la
   propia), `perfilApi.fetchPerfilPublico`, `negocioApi.mascotasPorId` y
   `paseadorApi` (enriquecer paseos, reseñas). `calcularEdadAnios(FechaNacimiento)`
   pasó a usar la columna `EdadAnios` ya calculada donde el dato viene de la
   vista. Pendiente del lado de la base (no de esta pasada): `negocioApi` y
   `paseadorApi` perdieron el peso/fecha de nacimiento de mascotas ajenas
   (no están en `mascota_publica`) — hace falta una vista/política aparte
   para negocio-con-turno y paseador-con-paseo que sí los incluya.
2. ~~App — `fichaMedicaApi.js`~~ — hecho: `subirImagenConsulta` sube al bucket
   privado `fichas-medicas` (`utils/imagenStorage.subirImagenPrivada`) y
   `fetchConsultas` resuelve la URL con `createSignedUrl` (300 s). Las
   consultas viejas con URL pública completa siguen mostrándose igual.
3. ~~App — `services/comun.js` `notificar()`~~ — hecho: ahora llama a
   `supabase.rpc('crear_notificacion', {...})`; si no hay match/amistad/trato
   con el destino la RPC tira error y se traga igual (nunca rompe el flujo,
   como antes), sólo se loguea en `__DEV__`.
4. ~~App — `migrar-cuenta`~~ — hecho: `iniciarSesionConPassword` devuelve
   `debeCambiarContrasena`, y los tres login (dueño, paseador, negocio)
   mandan a `ConfigCambiarContrasena` (con un aviso) antes de entrar cuando
   viene en `true`. Límite conocido: sólo se avisa UNA vez, en el momento de
   la migración (`migrar-cuenta` borra el hash viejo, así que no hay forma de
   volver a detectarlo en un login posterior) — si la persona vuelve atrás
   sin cambiarla, nadie se lo vuelve a pedir. Forzarlo de verdad (bloquear la
   navegación hasta que la cambie) queda para otra pasada.
5. **Dashboard de Supabase** (no se puede activar desde el SQL):
   - Authentication → Providers → Email → **Confirm email: activar**.
   - Database → Extensions → activar `pg_cron` y programar
     `SELECT _purgar_datos_antiguos();` (purga `PaseoTrack` y `sos_call_logs`
     viejos).
   - Authentication → Policies → contraseña mínima 8 caracteres.
   - `supabase secrets set ALLOWED_ORIGINS=https://tu-dominio,...` en las dos
     Edge Functions (si no, el CORS restringido no deja pasar a la app real).
6. **Probar después de pegar el SQL** (nada de esto se probó contra una base
   real, sólo se revisó línea por línea): registro y login de cuenta vieja y
   nueva, Match completo, pedido, turno, paseo completo (incluido pausar/
   reanudar: el nuevo control anti-trampa de `SegundosAcumulados`/
   `DistanciaMetros` puede ser demasiado estricto si el teléfono estuvo sin
   señal y manda un salto grande al reconectar — si pasa, avisar para
   relajar el margen de tolerancia), pedir amistad y aceptarla, bloquear a
   alguien, ZooniVet.
7. Pendiente sin resolver todavía (quedó anotado en el propio SQL, al final
   de la sección 070, por qué): límite de frecuencia general en toda
   escritura, firma real de archivos subidos (no sólo el `contentType`),
   nombres de archivo no predecibles, piso de precio por minuto en
   solicitudes abiertas de paseo. (La limpieza de Storage al borrar filas
   —#70— sí se hizo, del lado de la app: ver más abajo.)

### Hallazgos del lado de la app (`INFORME_SEGURIDAD_ZOONI.md`), ya resueltos
- **#24** Leaflet dentro de los iframes `srcDoc` (`MapaPaseo`, `ZonaMapaPicker`,
  `ComunidadScreen`) — ver el detalle completo más abajo.
- **#40** `NotificationsPanel`: el nombre/foto del chat y el nombre/tipo del
  negocio ya no vienen de `DataExtra` (cualquiera con una relación puede
  haberlos escrito) — se resuelven de la base por `chatDeMatchPorMascota` /
  `fetchServiciosPorId`.
- **#41** `PopupServicio`: `google_maps_url` sólo se abre si es un link real de
  Google Maps (`https://` + host conocido); si no, se arma uno propio con
  lat/lng.
- **#42** `MediaResena`: `esUrlPropia()` (nuevo, en `utils/imagenStorage.js`)
  valida que la foto/video de una reseña sea del propio Storage (o `data:`)
  antes de mostrarla o abrirla.
- **#68 / #138** Fotos de perfil de Google/Facebook: `socialAuthApi.js` ahora
  las descarga y las sube a `public-images` (`copiarFotoSocial`) en vez de
  guardar el link externo — sólo para cuentas **nuevas** de acá en adelante;
  las que ya tienen el link de Google/Facebook guardado no se migran solas.
- **#69** EXIF de las fotos: lo saca `utils/elegirImagen.js` (ver arriba).
- **#65** Lat/Lng exactos de Match: **ya estaba resuelto** por el trigger de
  `070` (`round(..., 2)` antes de guardar en `"User"`), no hizo falta tocar
  la app.
- **#67** Área exacta a Overpass: **ya estaba resuelto** — `lugaresOsm.js` ya
  redondeaba a una grilla de 0.02° antes de armar la consulta.
- **#81** Mail existente revelado en el registro: **no se tocó a propósito**
  — hoy es un mensaje explícito e intencional ("ya hay una cuenta con este
  mail"); volverlo ambiguo es una decisión de producto, no un bug, y cambiar
  la UX de registro no entraba en esta pasada.
- **#82** Mail recordado tras cerrar sesión: opt-out nuevo en Configuración ›
  Cuenta y seguridad › Sesión ("Recordar mi mail en este dispositivo"),
  `settingsStore.device.recordar_mail` (default `true`).
- **#123** `buscarUsuarios`: escapa `%`/`_`/`\` antes del `ilike` y exige 2
  caracteres (ya lo pedía el buscador, ahora también la función).
- **#124** Filtros `.or()` armados con ids: forzados a `Number(...)` en los 9
  lugares que interpolaban (`chatStore`, `paseadorApi`, `matchApi`,
  `perfilApi`, `api/comunidad`) — el más importante es
  `matchApi.chatDeMatchPorMascota`, cuyo id puede venir de `DataExtra`.
- **#125** `subirImagenPublica`: la extensión de una uri sin punto
  (`content://…`, `blob:…`) ya no se cuela en la key de Storage; cae a `jpg`,
  igual que `subirArchivoPublico`.
- **#126 / #127** `console.error`/`console.log` con detalle de Supabase: los
  ~16 lugares quedaron detrás de `if (__DEV__)`. El detalle real (`e.detalle`)
  que se mostraba EN PANTALLA en `NegocioRegistroScreen`,
  `PaseadorRegistroScreen` y `SolicitarPaseoScreen` también quedó sólo para
  `__DEV__` — sin tocar la lógica que sí necesita leer `err.detalle` para
  decidir qué campo marcar (`servicios_invalidos`, `genero_invalido`…), eso
  no es "exponerlo", es leerlo.
- **#128** `resetDemoMatchState` (borraba Votos reales desde "Restablecer
  filtros" en Match): eliminada.
- **#130** `app.json`: `android.allowBackup: false`. El permiso explícito
  (`android.permissions`) **no** se tocó: no hay forma de armar la lista a
  ciegas sin arriesgar romper cámara/ubicación en un build real que no se
  puede probar acá.
- **#132** `vercel.json`: `npm ci` en vez de `npm install` (se verificó que
  el lockfile está sincronizado).
- **#142** `zooni-app/.expo/README.md` y `devices.json`: sacados del índice
  de git (`git rm --cached`), quedan en el disco.
- **#144** `api.js`: `getStoredToken`/`saveToken` (muertas) eliminadas;
  `clearToken` se mantiene (sí se usa al cerrar sesión).
- **#145** El `<script>` y los dos `<style>` en línea de `public/index.html`
  pasaron a `public/touch-fix.js` y `public/app-shell.css`.
- **#46 / #47 / #131** `vercel.json`: `Content-Security-Policy`,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` nuevos. La CSP permite `unpkg.com` (Leaflet),
  `*.supabase.co`, `places.googleapis.com`, los tres Overpass y los tiles de
  OSM — **no se pudo probar contra un build real**: si algo de la app deja
  de cargar después de desplegar, revisar la consola del navegador por
  violaciones de CSP y ajustar esa línea antes que sacar la cabecera entera.

- **#24** Leaflet en los iframes `srcDoc` (`MapaPaseo.jsx`, `ZonaMapaPicker.jsx`,
  `ComunidadScreen.jsx`): `integrity`+`crossorigin` en el CSS y el JS de
  unpkg, y `sandbox="allow-scripts"` (sin `allow-same-origin`) en los tres
  `<iframe>` — así el iframe queda en otro origen; si unpkg se compromete, el
  script ya no puede leer el `localStorage`/sesión de la app aunque pasara el
  hash (y si no pasa el hash, el navegador ni lo ejecuta). La comunicación
  pasó de llamadas directas a `contentWindow.__zooniX` (dejan de funcionar
  entre orígenes distintos) a `postMessage` en los dos sentidos. La
  geolocalización de `ComunidadScreen` (antes pedida DENTRO del iframe) se
  movió a React: un iframe sandboxed sin `allow-same-origin` no hereda la
  `Permissions-Policy: geolocation=(self)` del sitio, así que pedirla adentro
  habría dejado de andar. Probado en un servidor local aparte (no se pudo
  probar dentro de la app real, que necesita login): los hashes SRI son
  correctos (Leaflet carga e inicializa el mapa) y el `postMessage` viaja en
  los dos sentidos con el iframe sandboxed; confirmado además que el acceso
  directo a `contentWindow` quedó bloqueado (por eso hacía falta el cambio).
  **Probar en la app real** igual: mini-mapa del Home, mapa de Paseo activo,
  selector de zona del paseador/negocio, mapa de Comunidad (ubicación propia,
  tocar un pin, doble tap para cartel, arrastrar el mapa).

- **#70** `.remove()` de Storage al borrar la fila dueña: `eliminarFotoMascota`
  (`petsApi.js`), `eliminarConsulta` (`fichaMedicaApi.js`, bucket privado o
  público según sea una consulta nueva o vieja) y `borrarItem` de negocio
  (`negocioApi.js`) ahora leen la URL/ruta antes de borrar la fila y limpian
  el archivo después (nuevos `borrarImagenPublica`/`borrarArchivoPrivado` en
  `utils/imagenStorage.js`, nunca tiran si falla — la fila ya se borró).
  Quedan afuera a propósito: reseñas (no tienen un "borrar" en la app todavía)
  y reemplazar la foto de portada de una mascota (`setFotoPrincipalMascota`
  sube la nueva pero no borra la vieja — no es un borrado de fila, es un caso
  aparte, menor).
- **#83 / #84** `lib/supabase.js`: `almacenNativo.setItem` ahora borra los
  trozos de SecureStore sobrantes cuando la sesión nueva ocupa menos que la
  anterior, y las tres operaciones (get/set/remove) usan
  `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- **#129** `imagenBase64.js` `desdeUrl()` borra el archivo temporal (con
  `try/finally`) apenas lo lee a base64, se use o no para el PDF.

**Lo anterior, ya resuelto por la migración vieja (060-063):**
- Cascadas al borrar mascota no son parejas (`eventos_calendario`,
  `historial_peso`, `consultas_veterinarias` con CASCADE; `MascotaVacuna`,
  `Tratamiento`, `HistorialEvento`, `Voto`, `Match` sin). *(sigue pendiente,
  no lo tocó la auditoría de seguridad)*
- Chats por consulta periódica → Supabase Realtime. *(sigue pendiente)*
- Límite de mensajes por usuario en `zoonivet-chat`. *(sigue pendiente)*

## 5. Defensa oral
Repasar `docs/claude/flujos.md` (responde las preguntas del PDF) y la sección
060–062 de `SUPABASE_PEGAR_TODO.sql`.
