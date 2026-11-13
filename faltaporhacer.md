# Falta por hacer

Ordenado por prioridad. Lo hecho en la última pasada está al final.

## 1. Para que lo hecho funcione (hacerlo YA, en este orden)

**Si la base YA tiene 060–065 aplicadas** (la de producción): pegar
`supabase/MIGRACION_066_RLS_REAPLICAR.sql` → Run. **Urgente**: en producción
cualquier usuario logueado leía mails, teléfonos, notificaciones, mensajes y
paseos de todos (una política abierta sobrevivía). La 066 lo cierra y se
verifica sola (si algo no queda bien, hace ROLLBACK y no cambia nada).

**Si la base tiene 060–063:** pegar, en orden, `supabase/MIGRACION_064_SOBRE_063.sql`,
`supabase/MIGRACION_065_LOGIN_CUENTAS_VIEJAS.sql` y `MIGRACION_066_RLS_REAPLICAR.sql` → Run. DESPUÉS
`supabase functions deploy zoonivet-chat` (sólo para ZooniVet). Luego desplegar
la app. `migrar-cuenta` ya NO hace falta: 065 migra las cuentas viejas desde la base.

Los `supabase/tests/*.sql` NO se pegan en Supabase: son para Postgres local.

**Base vacía o sin 060–063:** los pasos de abajo.
1. **Desplegar las Edge Functions** (si no, las cuentas viejas no pueden entrar
   después del paso 2):
   ```bash
   supabase login
   supabase link --project-ref <ref-del-proyecto>
   supabase functions deploy migrar-cuenta --no-verify-jwt
   supabase secrets set GROQ_API_KEY=gsk_...
   supabase secrets set ZOONIVET_LIMITE_DIARIO=40   # opcional, 40 por defecto
   supabase functions deploy zoonivet-chat
   ```
2. **Pegar `supabase/SUPABASE_PEGAR_TODO.sql` entero** en Supabase → SQL Editor → Run.
3. Authentication → Providers → Email: habilitado (decidir "Confirm email", ver README).
4. (Opcional) Database → Extensions → **pg_cron** y volver a correr el SQL: así
   la purga de mascotas eliminadas corre sola cada noche.
5. Cargar en Vercel las variables de `zooni-app/.env.example` y redesplegar.
6. Probar en la app real: login con cuenta vieja, registro, Match (like
   recíproco), pedido en pet shop, turno, paseo completo, ZooniVet, subir foto,
   **chat en vivo** (dos sesiones a la vez), **consulta con imagen** (bucket
   privado). Nada de esto se probó contra la base real.
7. Correr lo que no se pudo correr en la última pasada:
   `cd zooni-app && npm run lint && npm test` y
   `node supabase/scripts/probar-esquema.mjs` (Postgres local).
8. Cuando `select count(*) from user_credentials` dé 0: borrar
   `zooni-app/src/services/authLegado.js`, su uso en `authApi.js` y
   `consultaRespaldo` en `services/perfilesPublicos.js`.

**Pendientes de la revisión del 12/11/2026** (lo demás quedó arreglado):
- Cargar veterinarias REALES (verificadas) en `veterinary_clinics`: hoy el SOS
  muestra las líneas de emergencia y la salida a Google Maps, sin lista propia.
- Verificación de paseadores: no hay quién verifique. Por ahora el dueño ve
  "Identidad sin verificar todavía" y puede contratar igual.
- Mismo dueño con dos Match con la misma persona (uno por mascota): son dos
  chats; se distinguen por las mascotas en el nombre. ¿Unificarlos?

## 2. Refactor pendiente (código)
- **Componentes casi iguales** (no idénticos: hay que decidir el diseño único
  mirando la app): `CardAplicado`/`CardSugerido` (Vacunas y Tratamientos),
  `EventoCard` (Calendario y Eventos), `PetIllustration` (Home y Ficha).
- Pantallas gigantes (SRP): `EventosScreen`, `CalendarioScreen`, `HomeScreen`,
  `TratamientosScreen`, `VacunasScreen` (800–1000 líneas): separar
  subcomponentes en archivos y la carga de datos en hooks.
- `services/paseadorApi.js` (~1.500 líneas) y `negocioApi.js` (~1.200): partir
  por tema (perfil, solicitudes, pagos, reseñas, chat / catálogo, turnos, pedidos).
- `edadDe` en `PaseadorRegistroScreen` repite lógica de `utils/calcularEdad`.
- Smoke test en el navegador del resto de las pantallas con una base real.

## 3. Diseño
- Grises `gris50`–`gris600` en `src/theme/colores.js`: definir una escala corta
  (requiere revisar visualmente cada pantalla que los usa).
- Modo oscuro: no existe.

## 4. Base y seguridad
- Las imágenes de consultas **anteriores a 064** siguen en el bucket público
  (`imagen_url`). Para moverlas: copiarlas a `consultas-privadas/<auth uid>/consultas/`,
  completar `imagen_path` y borrar el archivo público.
- Las fotos en Storage de una mascota purgada no se borran (sólo las filas).

## 5. Defensa oral
Repasar `docs/claude/flujos.md` (responde las preguntas del PDF) y las secciones
060–064 de `SUPABASE_PEGAR_TODO.sql`.

---

## Hecho en la última pasada
- **064 en el SQL**: cascadas parejas al borrar mascota (NOT NULL → CASCADE,
  admite NULL → SET NULL, `Paseo` conserva el cobro), FKs que faltaban en
  `mascota_fotos` / `mascota_estado_historial`, `purgar_mascotas_eliminadas()`
  (+ pg_cron si está), bucket privado `consultas-privadas` con URLs firmadas,
  `Mensaje` y `paseo_mensajes` en Realtime, cupo diario de ZooniVet.
- `zoonivet-chat` consume el cupo antes de llamar a Groq (`CUPO_AGOTADO`, 429).
- Chats (Match/servicio, negocio, paseo) por Realtime con `useRecargaEnVivo`
  (respaldo cada 30 s en vez de consultar cada 4 s).
- `utils/elegirImagen` reemplaza el código de fotos repetido en 18 archivos.
- `ui/Estrellas`, `ui/CampoFormulario` (`Campo`, `InputPassword`) y
  `EspecieTile` unificados.
- Los 7 avisos de `react-hooks/exhaustive-deps` corregidos.
