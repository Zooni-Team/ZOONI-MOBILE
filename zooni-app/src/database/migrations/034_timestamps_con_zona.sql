-- =============================================================================
-- Migración 034: timestamps con zona horaria (arregla el desfasaje de 3 horas)
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- EL BUG:
--   Un mensaje enviado a las 12:46 se mostraba como enviado a las 15:46.
--
--   La app guarda las fechas con `new Date().toISOString()`, que devuelve UTC
--   ("2026-09-06T15:46:00.118Z"). Las columnas se crearon como TIMESTAMP —SIN
--   zona— así que Postgres se queda con "15:46" y tira la Z: pierde el dato de
--   que eso era UTC.
--
--   Al leer, el cliente recibe "2026-09-06T15:46:00.118" (sin offset) y
--   JavaScript, por especificación, interpreta como HORA LOCAL un string de
--   fecha-hora sin zona. Resultado: 15:46 local, o sea la hora real + 3 en
--   Argentina. El error crece con el offset de cada país.
--
-- LA SOLUCIÓN:
--   Pasar esas columnas a TIMESTAMPTZ. Postgres guarda el instante real y
--   devuelve el valor CON offset ("...+00:00"), que JavaScript ya interpreta
--   bien. Después de esto no hace falta tocar el código de la app: los
--   `toISOString()` que ya escribe pasan a guardarse correctamente.
--
-- OJO CON EL ORIGEN DE CADA COLUMNA:
--   La conversión necesita saber en qué zona estaban escritos los valores que
--   YA están guardados, y no todas vienen del mismo lado:
--
--     · Las que escribe la app (toISOString) o el default NOW() de Postgres
--       están en UTC              → AT TIME ZONE 'UTC'
--     · eventos.fecha_hora se cargó por SQL con horarios pensados como hora
--       local ('2026-04-15 09:00:00' = 9 de la mañana en Buenos Aires)
--                                 → AT TIME ZONE 'America/Argentina/Buenos_Aires'
--
--   Convertir todo como UTC habría corrido los eventos públicos 3 horas para
--   atrás: la jornada de vacunación de las 9:00 pasaría a mostrarse 6:00.
-- =============================================================================

-- ── 1. Columnas escritas por la app o por NOW() → estaban en UTC ─────────────

ALTER TABLE "Mensaje"
  ALTER COLUMN "fecha" TYPE TIMESTAMPTZ USING "fecha" AT TIME ZONE 'UTC';
ALTER TABLE "Mensaje" ALTER COLUMN "fecha" SET DEFAULT now();

ALTER TABLE eventos_calendario
  ALTER COLUMN fecha_hora     TYPE TIMESTAMPTZ USING fecha_hora     AT TIME ZONE 'UTC',
  ALTER COLUMN creado_en      TYPE TIMESTAMPTZ USING creado_en      AT TIME ZONE 'UTC',
  ALTER COLUMN actualizado_en TYPE TIMESTAMPTZ USING actualizado_en AT TIME ZONE 'UTC';
ALTER TABLE eventos_calendario ALTER COLUMN creado_en      SET DEFAULT now();
ALTER TABLE eventos_calendario ALTER COLUMN actualizado_en SET DEFAULT now();

ALTER TABLE historial_peso
  ALTER COLUMN fecha TYPE TIMESTAMPTZ USING fecha AT TIME ZONE 'UTC';
ALTER TABLE historial_peso ALTER COLUMN fecha SET DEFAULT now();

ALTER TABLE "Notificacion"
  ALTER COLUMN "Fecha" TYPE TIMESTAMPTZ USING "Fecha" AT TIME ZONE 'UTC';
ALTER TABLE "Notificacion" ALTER COLUMN "Fecha" SET DEFAULT now();

ALTER TABLE "Publicacion"
  ALTER COLUMN "Fecha" TYPE TIMESTAMPTZ USING "Fecha" AT TIME ZONE 'UTC';
ALTER TABLE "Publicacion" ALTER COLUMN "Fecha" SET DEFAULT now();

-- ── 2. Eventos públicos: los horarios se cargaron como hora local ────────────
ALTER TABLE eventos
  ALTER COLUMN fecha_hora TYPE TIMESTAMPTZ
  USING fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires';

-- ── 3. Verificación (correr después) ─────────────────────────────────────────
--   · Todas deben decir "timestamp with time zone":
--       SELECT table_name, column_name, data_type
--       FROM information_schema.columns
--       WHERE (table_name, column_name) IN (
--         ('Mensaje','fecha'), ('eventos_calendario','fecha_hora'),
--         ('historial_peso','fecha'), ('Notificacion','Fecha'),
--         ('Publicacion','Fecha'), ('eventos','fecha_hora'))
--       ORDER BY table_name;
--
--   · El último mensaje tiene que coincidir con la hora real de tu reloj:
--       SELECT texto, fecha AT TIME ZONE 'America/Argentina/Buenos_Aires' AS hora_local
--       FROM "Mensaje" ORDER BY fecha DESC LIMIT 3;
--
--   · Los eventos públicos deben seguir en su horario original (09:00, 10:00…):
--       SELECT titulo, fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires'
--       FROM eventos ORDER BY fecha_hora;
