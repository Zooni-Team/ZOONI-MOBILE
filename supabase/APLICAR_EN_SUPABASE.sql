-- =============================================================================
-- APLICAR_EN_SUPABASE.sql — GENERADO por supabase/scripts/armar-paquete-supabase.mjs
-- NO EDITAR A MANO. Pegar ENTERO en Supabase → SQL Editor → Run.
-- =============================================================================
-- Qué hace: aplica sobre la base que ya existe (con datos) todo lo de la
-- refactorización: 051_contexto_zoonivet.sql, 052_consultas_alta_ok.sql, 053_mail_unico.sql, 054_objetos_del_dashboard.sql, 060_auth_supabase.sql, 061_rls_por_usuario.sql, 062_reglas_negocio.sql, 063_storage.sql.
--   · Identidad con Supabase Auth (060), RLS por usuario (061), reglas de
--     negocio en la base (062), Storage con límites (063) y objetos que
--     sólo existían en el dashboard (054).
--
-- ANTES de correrlo:
--   1. Desplegar las Edge Functions (si no, las cuentas viejas no pueden
--      entrar después de este script):
--        supabase functions deploy migrar-cuenta --no-verify-jwt
--        supabase secrets set GROQ_API_KEY=...
--        supabase functions deploy zoonivet-chat
--   2. Authentication → Providers → Email habilitado (ver README).
--
-- Seguridad del script:
--   · Todo corre en UNA transacción: si algo falla, no queda nada a medias.
--   · Es idempotente: se puede volver a correr.
--   · Primero verifica que la base tenga las migraciones anteriores (000–050);
--     si falta algo, frena con un mensaje que dice qué falta.
--   · No borra datos de usuarios. Sí reemplaza TODAS las políticas RLS y de
--     Storage por las de 061/063.
-- =============================================================================

BEGIN;

-- ─── Prerrequisitos (migraciones 000–050) ───────────────────────────────────
DO $prerrequisitos$
DECLARE
  faltan TEXT[] := '{}';
  t TEXT[];
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ARRAY['User', 'NombreUsuario', '025'],
    ARRAY['Mascota', 'VisibleEnMatch', '023b'],
    ARRAY['user_credentials', 'hash', '021'],
    ARRAY['consultas_veterinarias', 'mascota_id', '016'],
    ARRAY['historial_peso', 'mascota_id', '016'],
    ARRAY['eventos_calendario', 'mascota_id', '010'],
    ARRAY['paseador_perfil', 'servicios', '040'],
    ARRAY['Paseo', 'PrecioPactado', '045'],
    ARRAY['Paseo', 'Comision', '045'],
    ARRAY['Paseo', 'ResenaAspectos', '042'],
    ARRAY['Paseo', 'MedioPago', '044'],
    ARRAY['paseo_pagos', 'monto', '044'],
    ARRAY['negocio_perfil', 'datos', '046'],
    ARRAY['negocio_items', 'precios', '046'],
    ARRAY['negocio_turnos', 'informe', '046'],
    ARRAY['negocio_pedidos', 'items', '046'],
    ARRAY['paseador_opiniones', 'id_autor', '048'],
    ARRAY['mascota_fotos', 'url', '028'],
    ARRAY['usuarios_bloqueados', 'bloqueado_id', '029']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = t[1] AND column_name = t[2]) THEN
      faltan := faltan || format('%s.%s (migración %s)', t[1], t[2], t[3]);
    END IF;
  END LOOP;
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ARRAY['_email_social', '043'],
    ARRAY['login_social', '043'],
    ARRAY['registrar_social_con_mascota', '043'],
    ARRAY['registrar_paseador_social', '043'],
    ARRAY['activar_paseador_social', '043'],
    ARRAY['_upsert_negocio', '046'],
    ARRAY['_upsert_paseador_perfil', '040']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.proname = t[1]) THEN
      faltan := faltan || format('función %s (migración %s)', t[1], t[2]);
    END IF;
  END LOOP;
  IF array_length(faltan, 1) > 0 THEN
    RAISE EXCEPTION 'A esta base le faltan migraciones anteriores: %. Corré primero supabase/schema.sql (es idempotente) y después este archivo.',
      array_to_string(faltan, '; ');
  END IF;
END
$prerrequisitos$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 051_contexto_zoonivet.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- migracion_22.sql — Contexto de la mascota para ZooniVet, calculado en el servidor.
--
-- Parte del refactor de seguridad de ZooniVet: la GROQ_API_KEY deja de vivir en
-- el cliente y pasa a una Edge Function (supabase/functions/zoonivet-chat). Esta
-- función SQL es la ÚNICA fuente del contexto de la mascota: la usa la Edge
-- Function para armar el prompt y la app para los chips de sugerencia y para
-- habilitar el input. Todo lo calculable (edad, días de vacunas vencidas,
-- tendencia de peso) se resuelve acá, en SQL, para que el modelo solo redacte.
--
-- Devuelve un jsonb con la misma forma que consumía construirContextoMascota:
--   { id, nombre, especie, raza, edadTexto, edadMeses, etapa, pesoKg,
--     pesoTendencia, vacunasAplicadas[], vacunasPendientes[], consultas[], fechaHoy }
-- Devuelve NULL si la mascota no existe.
--
-- EJECUTAR EN SUPABASE: pegá este archivo en el SQL Editor y corré. No pisa datos.

create or replace function public.get_pet_chat_context(p_pet_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m               record;
  v_hoy             date := current_date;
  v_edad_meses      int;
  v_anios           int;
  v_meses           int;
  v_edad_texto      text;
  v_etapa           text;
  v_es_gato         boolean;
  v_vac_aplicadas   jsonb;
  v_vac_pendientes  jsonb;
  v_consultas       jsonb;
  v_tendencia       text;
  v_peso_reciente   numeric;
  v_peso_previo     numeric;
  v_fecha_reciente  date;
  v_fecha_previo    date;
  v_delta           numeric;
  v_dias            int;
  v_periodo         text;
  v_n_pesos         int;
begin
  select "Id_Mascota"     as id,
         "Nombre"         as nombre,
         "Especie"        as especie,
         "Raza"           as raza,
         "Peso"           as peso,
         "FechaNacimiento" as fnac
    into v_m
  from "Mascota"
  where "Id_Mascota" = p_pet_id;

  if not found then
    return null;
  end if;

  v_es_gato := lower(coalesce(v_m.especie, '')) like '%gato%';

  -- ── Edad (misma cuenta que calcularEdad/calcularEdadMeses en JS) ──────────
  if v_m.fnac is not null then
    v_edad_meses := greatest(
      0,
      (extract(year  from age(v_hoy, v_m.fnac)) * 12
     + extract(month from age(v_hoy, v_m.fnac)))::int
    );
    v_anios := v_edad_meses / 12;
    v_meses := v_edad_meses % 12;

    if v_anios = 0 then
      v_edad_texto := v_meses || case when v_meses = 1 then ' mes' else ' meses' end;
    else
      v_edad_texto :=
        v_anios || case when v_anios = 1 then ' año'  else ' años'  end || ' y ' ||
        v_meses || case when v_meses = 1 then ' mes'  else ' meses' end;
    end if;
  end if;

  -- ── Etapa de vida (flag resuelto para el modelo) ──────────────────────────
  if v_edad_meses is null then
    v_etapa := 'adulto';
  elsif v_edad_meses < 12 then
    v_etapa := 'cachorro';
  elsif (v_es_gato and v_edad_meses >= 132) or (not v_es_gato and v_edad_meses >= 96) then
    v_etapa := 'senior';
  else
    v_etapa := 'adulto';
  end if;

  -- ── Vacunas aplicadas: "Nombre (YYYY-MM-DD)", más recientes primero ───────
  select coalesce(
    jsonb_agg(txt order by fapp desc),
    '[]'::jsonb
  )
    into v_vac_aplicadas
  from (
    select coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
             || ' (' || to_char(mv."FechaAplicacion", 'YYYY-MM-DD') || ')' as txt,
           mv."FechaAplicacion" as fapp
    from "MascotaVacuna" mv
    left join "Vacuna" vc on vc."Id_Vacuna" = mv."Id_Vacuna"
    where mv."Id_Mascota" = p_pet_id
      and mv."FechaAplicacion" is not null
  ) s;

  -- ── Vacunas pendientes/vencidas con días exactos (solo <= 30 días o vencidas) ─
  select coalesce(
    jsonb_agg(txt order by prox asc),
    '[]'::jsonb
  )
    into v_vac_pendientes
  from (
    select
      case
        when (mv."ProximaDosis" - v_hoy) < 0 then
          coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
            || ': vencida hace ' || (v_hoy - mv."ProximaDosis") || ' días'
        else
          coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
            || ': vence en ' || (mv."ProximaDosis" - v_hoy) || ' días'
      end as txt,
      mv."ProximaDosis" as prox
    from "MascotaVacuna" mv
    left join "Vacuna" vc on vc."Id_Vacuna" = mv."Id_Vacuna"
    where mv."Id_Mascota" = p_pet_id
      and mv."ProximaDosis" is not null
      and (mv."ProximaDosis" - v_hoy) <= 30
  ) s;

  -- ── Consultas recientes (hasta 3), motivo recortado a 120 ─────────────────
  select coalesce(
    jsonb_agg(
      jsonb_build_object('fecha', to_char(fecha, 'YYYY-MM-DD'), 'motivo', left(motivo, 120))
      order by fecha desc
    ),
    '[]'::jsonb
  )
    into v_consultas
  from (
    select fecha, motivo
    from consultas_veterinarias
    where mascota_id = p_pet_id
    order by fecha desc
    limit 3
  ) c;

  -- ── Tendencia de peso: más reciente vs más antiguo entre los últimos 12 ────
  with ult as (
    select peso_kg, fecha
    from historial_peso
    where mascota_id = p_pet_id
    order by fecha desc
    limit 12
  )
  select
    count(*),
    (select peso_kg from ult order by fecha desc limit 1),
    (select fecha   from ult order by fecha desc limit 1),
    (select peso_kg from ult order by fecha asc  limit 1),
    (select fecha   from ult order by fecha asc  limit 1)
  into v_n_pesos, v_peso_reciente, v_fecha_reciente, v_peso_previo, v_fecha_previo
  from ult;

  if v_n_pesos >= 2 and v_fecha_reciente is not null and v_fecha_previo is not null then
    v_delta := v_peso_reciente - v_peso_previo;
    v_dias  := v_fecha_reciente - v_fecha_previo;
    if v_delta <> 0 and v_dias > 0 then
      if v_dias >= 30 then
        v_periodo := round(v_dias / 30.0)::int || ' meses';
      else
        v_periodo := v_dias || ' días';
      end if;
      -- Formato 'FM990.0' usa un punto literal (no depende del locale, a
      -- diferencia de 'D'); después lo pasamos a coma como en el front.
      v_tendencia :=
        case when v_delta > 0 then 'subió ' else 'bajó ' end
        || replace(to_char(abs(v_delta), 'FM990.0'), '.', ',')
        || ' kg en ' || v_periodo;
    end if;
  end if;

  -- ── Ensamblado final ──────────────────────────────────────────────────────
  return jsonb_build_object(
    'id',               v_m.id,
    'nombre',           coalesce(nullif(trim(v_m.nombre), ''), 'tu mascota'),
    'especie',          v_m.especie,
    'raza',             v_m.raza,
    'edadTexto',        v_edad_texto,
    'edadMeses',        v_edad_meses,
    'etapa',            v_etapa,
    'pesoKg',           v_m.peso,
    'pesoTendencia',    v_tendencia,
    'vacunasAplicadas', v_vac_aplicadas,
    'vacunasPendientes', v_vac_pendientes,
    'consultas',        v_consultas,
    'fechaHoy',         to_char(v_hoy, 'YYYY-MM-DD')
  );
end;
$$;

-- La app usa la anon key y las Edge Functions la service_role; ambas necesitan
-- poder ejecutar la función. (RLS sigue deshabilitado en este proyecto.)
grant execute on function public.get_pet_chat_context(bigint) to anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 052_consultas_alta_ok.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Migración 031: dejar andando el alta de consultas veterinarias
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- SÍNTOMA:
--   POST /rest/v1/consultas_veterinarias  →  400 (Bad Request)
--   "No se pudo guardar la consulta" en la pantalla de Consultas.
--
-- CAUSA:
--   La base tiene la tabla de la migración 016 pero NO la 030, así que le falta
--   la columna imagen_url. PostgREST rechaza el insert entero con 400 PGRST204
--   ("Could not find the 'imagen_url' column ... in the schema cache").
--   Otras variantes del mismo 400/401: RLS prendido, o el rol anon sin permiso
--   sobre la tabla o sobre la secuencia del id.
--
-- Esta migración deja las cuatro cosas en orden de una sola vez. La app además
-- ahora reintenta sin imagen si la columna no está (fichaMedicaApi.crearConsulta),
-- así que el alta no se pierde — pero para adjuntar imágenes hay que correr esto.
-- =============================================================================

-- ── 0. Por si la base es vieja y ni siquiera tiene la tabla (016) ─────────────
CREATE TABLE IF NOT EXISTS consultas_veterinarias (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  motivo      VARCHAR(150) NOT NULL,
  notas       TEXT,
  veterinario VARCHAR(120),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- ── 1. Columna de la imagen adjunta (URL pública de Storage) ──────────────────
ALTER TABLE consultas_veterinarias ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ── 2. Sin RLS, igual que el resto del proyecto (la app usa la anon key) ──────
ALTER TABLE consultas_veterinarias DISABLE ROW LEVEL SECURITY;

-- ── 3. Permisos del rol anon: tabla + secuencia del id ────────────────────────
--     Sin USAGE en la secuencia, el DEFAULT nextval() falla y el insert también.
GRANT SELECT, INSERT, UPDATE, DELETE ON consultas_veterinarias TO anon;
DO $$
DECLARE v_seq TEXT := pg_get_serial_sequence('consultas_veterinarias', 'id');
BEGIN
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon', v_seq);
  END IF;
END $$;

-- ── 4. Refrescar el cache de esquema de PostgREST ─────────────────────────────
--     Sin esto la API puede seguir devolviendo PGRST204 unos segundos más.
NOTIFY pgrst, 'reload schema';

-- ── 5. Verificación (opcional, correr después) ────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'consultas_veterinarias';            -- debe incluir imagen_url
--   SELECT relrowsecurity FROM pg_class
--   WHERE relname = 'consultas_veterinarias';               -- debe ser false


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 053_mail_unico.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- Migración 032: un mail = una cuenta (y teléfono opcional)
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- SÍNTOMA:
--   Se podían crear DOS usuarios con el mismo mail.
--
-- CAUSA:
--   El único control era el chequeo previo de la app / de la RPC
--   (SELECT ... WHERE lower(Mail) = ... antes del INSERT). Eso no alcanza:
--     · es case-sensitive según cómo se guardó el mail (Ana@x.com vs ana@x.com);
--     · entre el SELECT y el INSERT puede colarse otro registro (dos toques
--       seguidos en "Continuar" ya bastan);
--     · el UNIQUE del esquema original se perdió en las bases creadas a partir
--       de las migraciones.
--   La garantía tiene que estar en la base, no en el cliente.
--
-- Además: el teléfono es OPCIONAL en el registro. Acá se afloja cualquier
-- NOT NULL que haya quedado sobre las columnas de teléfono.
-- =============================================================================

-- ── 1. Limpiar duplicados existentes antes de crear el índice ────────────────
--    Se conserva la cuenta MÁS VIEJA de cada mail (la que tiene los datos) y a
--    las repetidas se les marca el mail para que el índice pueda crearse sin
--    borrar nada: ningún dato se pierde y quedan visibles para revisarlas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT "Id_User", "Mail"
    FROM (
      SELECT "Id_User", "Mail",
             ROW_NUMBER() OVER (PARTITION BY lower(trim("Mail")) ORDER BY "Id_User") AS n
      FROM "User"
      WHERE "Mail" IS NOT NULL
    ) t
    WHERE t.n > 1
  LOOP
    UPDATE "User"
    SET "Mail" = 'duplicado+' || r."Id_User" || '_' || r."Mail"
    WHERE "Id_User" = r."Id_User";
    RAISE NOTICE 'Mail duplicado renombrado en Id_User=%: %', r."Id_User", r."Mail";
  END LOOP;
END $$;

-- ── 2. LA garantía: índice único sobre el mail normalizado ───────────────────
--    Case-insensitive y sin espacios: ANA@x.com y  ana@x.com  son el mismo mail.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mail_unico
  ON "User" (lower(trim("Mail")));

-- ── 3. El teléfono es opcional ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'User' AND column_name = 'Telefono'
               AND is_nullable = 'NO') THEN
    ALTER TABLE "User" ALTER COLUMN "Telefono" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'User' AND column_name = 'CodigoTelefono'
               AND is_nullable = 'NO') THEN
    ALTER TABLE "User" ALTER COLUMN "CodigoTelefono" DROP NOT NULL;
  END IF;
END $$;

-- Las columnas de teléfono existen (por si la base viene del esquema original)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Telefono" VARCHAR(30);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "CodigoTelefono" VARCHAR(10);

-- ── 4. La RPC de registro traduce el choque del índice a 'email_existente' ────
--     Sin esto, el segundo registro simultáneo devolvía un error crudo de
--     Postgres ("duplicate key value...") y la app mostraba "Error genérico".
CREATE OR REPLACE FUNCTION registrar_usuario_con_mascota(
  p_usuario JSONB, p_hash TEXT, p_mascota JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mail TEXT := lower(trim(p_usuario->>'email'));
  v_id INTEGER;
BEGIN
  IF v_mail IS NULL OR v_mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE lower(trim("Mail")) = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 32 THEN
    RAISE EXCEPTION 'hash_invalido';
  END IF;

  INSERT INTO "User" (
    "Nombre", "Apellido", "Mail", "Telefono", "CodigoTelefono",
    "Pais", "PaisCodigo", "Provincia", "Ciudad", "Ubicacion"
  ) VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    NULLIF(left(p_usuario->>'telefono', 30), ''),        -- opcional
    NULLIF(left(p_usuario->>'codigoTelefono', 10), ''),  -- opcional
    left(p_usuario->>'pais', 100),
    left(p_usuario->>'paisCodigo', 5),
    left(p_usuario->>'provincia', 100),
    left(p_usuario->>'ciudad', 100),
    left(p_usuario->>'ubicacion', 200)
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);

  INSERT INTO "Mascota" (
    "Id_User", "Nombre", "Especie", "Sexo", "Raza", "Peso",
    "FechaNacimiento", "ImagenAsset", "EsActiva"
  ) VALUES (
    v_id,
    left(trim(p_mascota->>'nombre'), 30),
    left(p_mascota->>'especie', 50),
    left(p_mascota->>'sexo', 10),
    left(p_mascota->>'raza', 100),
    NULLIF(p_mascota->>'peso', '')::NUMERIC,
    NULLIF(p_mascota->>'fechaNacimiento', '')::DATE,
    COALESCE(left(p_mascota->>'imagenAsset', 100), 'perro_default'),
    TRUE
  );

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (v_id, 1);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);

EXCEPTION
  -- Carrera perdida contra otro registro con el mismo mail: el índice único
  -- lo frena y acá se traduce al mismo error que ya entiende la app.
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%idx_user_mail_unico%' OR SQLERRM LIKE '%Mail%' THEN
      RAISE EXCEPTION 'email_existente';
    END IF;
    RAISE;
END $$;

GRANT EXECUTE ON FUNCTION registrar_usuario_con_mascota(JSONB, TEXT, JSONB) TO anon;

NOTIFY pgrst, 'reload schema';

-- ── 5. Verificación (opcional) ───────────────────────────────────────────────
--   SELECT indexname FROM pg_indexes WHERE tablename = 'User';  -- idx_user_mail_unico
--   SELECT lower(trim("Mail")), COUNT(*) FROM "User"
--     GROUP BY 1 HAVING COUNT(*) > 1;                            -- 0 filas


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 054_objetos_del_dashboard.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- 054_objetos_del_dashboard.sql — Lo que existía en la base viva pero no en
-- ningún script. Idempotente.
-- =============================================================================
-- Al comparar el esquema que arman 000…053 sobre una base vacía contra el
-- export de la base real (modelo_datos_zooni.txt, ya quitado del repo), las
-- únicas diferencias eran estas dos, creadas a mano desde el dashboard:
--
--   · "User"."UltimaConexion": la usa presenciaApi.js para el "en línea" de
--     Comunidad.
--   · zooni_politica_tablas: tabla de anotaciones que acompañaba a las
--     políticas "zooni_app_acceso" / "zooni_catalogo_lectura". Esas políticas
--     las reemplaza 061_rls_por_usuario.sql; la tabla queda para no perder
--     la documentación de qué es catálogo y qué es dato de usuario.
-- =============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "UltimaConexion" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS zooni_politica_tablas (
  tabla     TEXT PRIMARY KEY,
  categoria TEXT NOT NULL,
  motivo    TEXT
);

ALTER TABLE zooni_politica_tablas ENABLE ROW LEVEL SECURITY;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 060_auth_supabase.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- 060_auth_supabase.sql — La identidad pasa a ser un JWT de Supabase Auth.
-- Idempotente. Requiere 021, 043, 046.
-- =============================================================================
-- ANTES: la app guardaba en el dispositivo el número "Id_User" y lo mandaba en
-- cada consulta como si fuera la prueba de quién es. La base no tenía forma de
-- verificarlo: cualquiera con la clave pública podía decir "soy el 7".
-- Y la contraseña viajaba como SHA-256 sin sal: ese hash ERA la contraseña
-- (quien lo veía pasar podía reusarlo tal cual).
--
-- AHORA:
--   · El login es supabase.auth.signInWithPassword: Supabase Auth guarda la
--     contraseña con bcrypt (sal + costo) y devuelve un JWT firmado.
--   · "User".auth_id une la fila de Zooni con el usuario de Supabase Auth.
--   · usuario_actual() traduce el JWT (auth.uid()) al Id_User. Es lo ÚNICO
--     en lo que se apoyan las políticas de 061: nada que mande el cliente.
--
-- Cuentas viejas (con hash en user_credentials): la primera vez que entran,
-- la Edge Function `migrar-cuenta` comprueba el hash viejo, crea su usuario de
-- Supabase Auth con la MISMA contraseña y borra el hash viejo. Ver
-- supabase/functions/migrar-cuenta/index.ts.
--
-- Las RPC "_social" de la 043 (login_social, registrar_social_con_mascota,
-- registrar_paseador_social, activar_paseador_social) ya leían el mail desde
-- auth.users con auth.uid(): sirven igual para una sesión de contraseña. El
-- nombre quedó de cuando sólo se usaban con Google/Facebook.
-- =============================================================================

-- ─── 1. Vínculo User ↔ auth.users ───────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS auth_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_auth_id_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT user_auth_id_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_id ON "User"(auth_id) WHERE auth_id IS NOT NULL;

-- ─── 2. ¿Quién es el que pregunta? ──────────────────────────────────────────
-- SECURITY DEFINER: así las políticas de "User" pueden llamarla sin recursión.
CREATE OR REPLACE FUNCTION usuario_actual()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "Id_User" FROM "User" WHERE auth_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION usuario_actual() FROM public;
GRANT EXECUTE ON FUNCTION usuario_actual() TO anon, authenticated, service_role;

-- ─── 3. Toda alta hecha con sesión queda vinculada a esa sesión ─────────────
-- Las RPC de alta (registrar_social_con_mascota, registrar_paseador_social,
-- registrar_negocio_sesion…) insertan en "User" con SECURITY DEFINER; auth.uid()
-- sigue siendo el del JWT del pedido. Sólo se vincula si el mail coincide con
-- el de la sesión: nadie puede "adueñarse" de una fila con otro mail.
CREATE OR REPLACE FUNCTION _vincular_auth_en_alta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_mail TEXT;
BEGIN
  IF NEW.auth_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT lower(email) INTO v_mail FROM auth.users WHERE id = auth.uid();
    IF v_mail IS NOT NULL AND v_mail = lower(trim(NEW."Mail")) THEN
      NEW.auth_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_vincular_auth ON "User";
CREATE TRIGGER trg_user_vincular_auth
  BEFORE INSERT ON "User"
  FOR EACH ROW EXECUTE FUNCTION _vincular_auth_en_alta();

-- ─── 3b. El mail lo administra Supabase Auth ────────────────────────────────
-- Cambiar de mail = supabase.auth.updateUser({ email }) (con confirmación).
-- Cuando Auth confirma el cambio, se copia acá. La app ya no escribe
-- "User".Mail (061 le saca ese permiso).
CREATE OR REPLACE FUNCTION _sincronizar_mail_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE "User" SET "Mail" = lower(NEW.email) WHERE auth_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zooni_sincronizar_mail ON auth.users;
CREATE TRIGGER trg_zooni_sincronizar_mail
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION _sincronizar_mail_auth();

-- ─── 4. login_social(): ahora también vincula la cuenta existente ───────────
-- Misma respuesta que en la 043; lo nuevo es el UPDATE de auth_id para
-- cuentas creadas antes de esta migración que entran por primera vez con un
-- proveedor (Google/Facebook) o ya migradas por `migrar-cuenta`.
CREATE OR REPLACE FUNCTION login_social()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_meta JSONB;
  v_user RECORD;
  v_completo TEXT;
BEGIN
  SELECT * INTO v_user FROM "User" WHERE lower("Mail") = v_mail;
  IF FOUND THEN
    IF v_user.auth_id IS NULL THEN
      -- Cuenta vieja con contraseña sin migrar: NO se vincula a una sesión de
      -- contraseña cualquiera. Si no, alguien podría hacer signUp con el mail
      -- de otra persona y quedarse con su cuenta. Primero tiene que pasar por
      -- migrar-cuenta (que comprueba la contraseña vieja). Con Google /
      -- Facebook sí se vincula: el proveedor verificó que el mail es suyo.
      IF EXISTS (SELECT 1 FROM user_credentials WHERE id_user = v_user."Id_User")
         AND NOT EXISTS (SELECT 1 FROM auth.identities
                         WHERE user_id = auth.uid() AND provider <> 'email') THEN
        RAISE EXCEPTION 'cuenta_sin_migrar';
      END IF;
      UPDATE "User" SET auth_id = auth.uid() WHERE "Id_User" = v_user."Id_User";
    ELSIF v_user.auth_id <> auth.uid() THEN
      RAISE EXCEPTION 'cuenta_vinculada_a_otra_sesion';
    END IF;
    RETURN jsonb_build_object(
      'nuevo',      FALSE,
      'id',         v_user."Id_User",
      'nombre',     v_user."Nombre",
      'apellido',   v_user."Apellido",
      'email',      v_user."Mail",
      'fotoPerfil', v_user."FotoPerfil"
    );
  END IF;

  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = auth.uid();
  v_completo := trim(COALESCE(v_meta->>'full_name', v_meta->>'name', ''));
  RETURN jsonb_build_object(
    'nuevo',    TRUE,
    'email',    v_mail,
    'nombre',   COALESCE(NULLIF(v_meta->>'given_name', ''), NULLIF(split_part(v_completo, ' ', 1), '')),
    'apellido', COALESCE(NULLIF(v_meta->>'family_name', ''), NULLIF(regexp_replace(v_completo, '^\S+\s*', ''), '')),
    'foto',     COALESCE(v_meta->>'avatar_url', v_meta->>'picture')
  );
END $$;

REVOKE ALL ON FUNCTION login_social() FROM anon, public;
GRANT EXECUTE ON FUNCTION login_social() TO authenticated;

-- ─── 5. Negocios con sesión (equivalentes "_social" que faltaban) ───────────
-- registrar_negocio / activar_negocio de la 046 recibían mail + hash. Estas
-- toman el mail de la sesión, igual que las de paseador de la 043.
CREATE OR REPLACE FUNCTION registrar_negocio_sesion(p_usuario JSONB, p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_id INTEGER;
  v_negocio INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;

  INSERT INTO "User" ("Nombre", "Apellido", "Mail", "Telefono", "Ubicacion")
  VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    NULLIF(left(trim(p_usuario->>'telefono'), 30), ''),
    left(trim(p_negocio->>'direccion'), 300)
  )
  RETURNING "Id_User" INTO v_id;

  v_negocio := _upsert_negocio(v_id, p_negocio);
  RETURN jsonb_build_object('id', v_id, 'email', v_mail, 'idNegocio', v_negocio);
END $$;

CREATE OR REPLACE FUNCTION activar_negocio_sesion(p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_id INTEGER := usuario_actual();
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'sin_cuenta'; END IF;
  PERFORM _upsert_negocio(v_id, p_negocio);
  RETURN jsonb_build_object('id', v_id);
END $$;

REVOKE ALL ON FUNCTION registrar_negocio_sesion(JSONB, JSONB) FROM anon, public;
REVOKE ALL ON FUNCTION activar_negocio_sesion(JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION registrar_negocio_sesion(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION activar_negocio_sesion(JSONB) TO authenticated;

-- ─── 6. Disponibilidad de mail / @usuario para el registro ──────────────────
-- Con RLS (061) un anónimo ya no puede leer "User" para chequear si un mail
-- está tomado. Esta función responde sólo sí/no, sin devolver filas.
CREATE OR REPLACE FUNCTION disponibilidad_registro(p_mail TEXT, p_usuario TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'mailTomado', p_mail IS NOT NULL AND EXISTS (
      SELECT 1 FROM "User" WHERE lower(trim("Mail")) = lower(trim(p_mail))),
    'usuarioTomado', NULLIF(trim(p_usuario), '') IS NOT NULL AND EXISTS (
      SELECT 1 FROM "User" WHERE lower("NombreUsuario") = lower(trim(both '@' from trim(p_usuario))))
  )
$$;

GRANT EXECUTE ON FUNCTION disponibilidad_registro(TEXT, TEXT) TO anon, authenticated;

-- ─── 7. Soporte para la Edge Function migrar-cuenta (sólo service_role) ─────
CREATE OR REPLACE FUNCTION _credencial_legada(p_mail TEXT)
RETURNS TABLE (id_user INTEGER, hash TEXT, auth_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."Id_User", c.hash, u.auth_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(trim(u."Mail")) = lower(trim(p_mail))
$$;

CREATE OR REPLACE FUNCTION _auth_id_por_mail(p_mail TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_mail)) LIMIT 1
$$;

-- Termina la migración de una cuenta: vincula y borra el hash viejo (la
-- contraseña ahora vive en Supabase Auth, con bcrypt).
CREATE OR REPLACE FUNCTION _completar_migracion_cuenta(p_id_user INTEGER, p_auth_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "User" SET auth_id = p_auth_id WHERE "Id_User" = p_id_user;
  DELETE FROM user_credentials WHERE id_user = p_id_user;
END $$;

REVOKE ALL ON FUNCTION _credencial_legada(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION _auth_id_por_mail(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION _completar_migracion_cuenta(INTEGER, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION _credencial_legada(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION _auth_id_por_mail(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION _completar_migracion_cuenta(INTEGER, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 061_rls_por_usuario.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- 061_rls_por_usuario.sql — Row Level Security de verdad. Idempotente.
-- Requiere 060 (usuario_actual()).
-- =============================================================================
-- ANTES: RLS estaba "activado" pero las políticas (zooni_app_acceso) decían
-- USING true / WITH CHECK true para anon y authenticated. O sea: cualquiera
-- que copiara la URL y la clave pública del bundle web podía leer y escribir
-- todo — fichas médicas, ubicaciones, chats, contraseñas viejas incluidas.
--
-- AHORA, el principio es mínimo privilegio:
--   · anon (sin sesión) sólo lee catálogos (razas, vacunas, líneas de
--     emergencia…). Todo lo demás pide un JWT de Supabase Auth.
--   · Cada fila se decide con usuario_actual(), que sale del JWT firmado.
--     Ningún dato que mande el cliente ("soy el 7") cuenta como identidad.
--   · Datos de salud (vacunas, tratamientos, consultas, peso, eventos): sólo
--     el dueño de la mascota.
--   · "User": cada uno ve SU fila completa. De los demás sólo se ve la vista
--     perfil_publico (sin mail, sin fecha de nacimiento exacta, ubicación
--     redondeada a ~1 km y teléfono sólo si hay un paseo/turno/pedido en común).
--
-- Cómo leer una política:   USING  = qué filas puedo VER / tocar
--                           WITH CHECK = qué filas puedo DEJAR escritas
-- Si para una operación no hay política, está prohibida.
-- =============================================================================

-- ─── 0. Helpers (SECURITY DEFINER: no disparan RLS dentro de RLS) ───────────

CREATE OR REPLACE FUNCTION es_mi_mascota(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = p_id AND "Id_User" = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_dueno_negocio(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM negocio_perfil WHERE id = p_id AND id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_dueno_servicio(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM servicios s JOIN negocio_perfil n ON n.id = s.id_negocio
    WHERE s.id = p_id AND n.id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION participo_en_match(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Match" WHERE id = p_id
      AND usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"))
$$;

CREATE OR REPLACE FUNCTION participo_en_paseo(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = p_id
      AND usuario_actual() IN ("Id_Dueno", "Id_Walker"))
$$;

CREATE OR REPLACE FUNCTION soy_walker_de_paseo(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = p_id AND "Id_Walker" = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_paseador()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION son_amigos(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM amistades WHERE estado = 'aceptada' AND (
      (usuario_a_id = usuario_actual() AND usuario_b_id = p_otro) OR
      (usuario_b_id = usuario_actual() AND usuario_a_id = p_otro)))
$$;

-- ¿Tengo un trato concreto con esta persona? (paseo, turno o pedido en común)
-- Es lo que habilita ver su teléfono.
CREATE OR REPLACE FUNCTION tengo_trato_con(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_otro = usuario_actual()
    OR EXISTS (SELECT 1 FROM "Paseo" WHERE
         ("Id_Dueno" = usuario_actual() AND "Id_Walker" = p_otro) OR
         ("Id_Walker" = usuario_actual() AND "Id_Dueno" = p_otro))
    OR EXISTS (SELECT 1 FROM negocio_turnos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         (t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
         (n.id_user = usuario_actual() AND t.id_dueno = p_otro))
    OR EXISTS (SELECT 1 FROM negocio_pedidos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         (t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
         (n.id_user = usuario_actual() AND t.id_dueno = p_otro))
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'es_mi_mascota(integer)', 'soy_dueno_negocio(integer)', 'soy_dueno_servicio(integer)',
    'participo_en_match(integer)', 'participo_en_paseo(integer)', 'soy_walker_de_paseo(integer)',
    'soy_paseador()', 'son_amigos(integer)', 'tengo_trato_con(integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─── 1. Borrar TODAS las políticas viejas y empezar de cero ─────────────────
-- (zooni_app_acceso, zooni_catalogo_lectura, zooni_alta_*, y las que se hayan
-- creado a mano en el dashboard). Lo que no esté escrito acá, no existe.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─── 2. RLS prendido en todas las tablas, permisos base ─────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    -- authenticated tiene permiso de tabla; QUÉ filas, lo deciden las políticas.
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Tablas internas: nadie desde el cliente (sólo funciones SECURITY DEFINER).
REVOKE ALL ON user_credentials, "__MigrationLog", zooni_politica_tablas FROM authenticated;

-- ─── 3. Catálogos: lectura pública (también anon: el registro usa razas) ────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Clinica', 'Role', 'Vacuna', 'Veterinario', 'avatares_catalogo', 'consejos_catalogo',
    'tratamientos_catalogo', 'razas', 'emergency_lines', 'veterinary_clinics',
    'organizadores_verificados', 'eventos'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('CREATE POLICY catalogo_lectura ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- ─── 4. "User": sólo mi fila. Lo de los demás, por perfil_publico ───────────
CREATE POLICY user_mi_fila_ver ON "User" FOR SELECT TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY user_mi_fila_editar ON "User" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual())
  WITH CHECK ("Id_User" = usuario_actual());
-- Altas y bajas de cuentas: sólo por RPC (060). Tampoco se puede tocar el
-- vínculo con Auth, el id ni el mail (el mail lo administra Supabase Auth:
-- si cambiara sólo acá, el login dejaría de encontrar la cuenta).
-- Ojo: en Postgres revocar UNA columna no le gana a un permiso de tabla, por
-- eso se revoca UPDATE entero y se da columna por columna.
REVOKE INSERT, UPDATE, DELETE ON "User" FROM authenticated;
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User'
      AND column_name NOT IN ('Id_User', 'auth_id', 'Mail')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON "User" TO authenticated', c);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW perfil_publico AS
SELECT
  u."Id_User",
  u."Nombre",
  u."Apellido",
  u."NombreUsuario",
  u."FotoPerfil",
  u."Bio",
  u."Ubicacion",
  u."Ciudad",
  u."Provincia",
  u."Pais",
  u."Genero",
  u."Intereses",
  u."UltimaConexion",
  u."Estado",
  -- Edad en años en vez de la fecha exacta de nacimiento
  CASE WHEN u."FechaNacimiento" IS NOT NULL
       THEN date_part('year', age(u."FechaNacimiento"))::INTEGER END AS "Edad",
  -- ~1,1 km de precisión: alcanza para "a 3 km" y no ubica la casa
  round(u."Lat", 2) AS "Lat",
  round(u."Lng", 2) AS "Lng",
  CASE WHEN tengo_trato_con(u."Id_User") THEN u."Telefono" END AS "Telefono"
FROM "User" u
WHERE usuario_actual() IS NOT NULL;

REVOKE ALL ON perfil_publico FROM anon, public;
GRANT SELECT ON perfil_publico TO authenticated;

-- ─── 5. Mascotas ────────────────────────────────────────────────────────────
-- Las mascotas se ven entre usuarios (Match, Comunidad, perfiles). Escribir:
-- sólo las propias.
CREATE POLICY mascota_ver ON "Mascota" FOR SELECT TO authenticated USING (true);
CREATE POLICY mascota_alta ON "Mascota" FOR INSERT TO authenticated
  WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY mascota_editar ON "Mascota" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY mascota_borrar ON "Mascota" FOR DELETE TO authenticated
  USING ("Id_User" = usuario_actual());

CREATE POLICY mascota_fotos_ver ON mascota_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY mascota_fotos_escribir ON mascota_fotos FOR ALL TO authenticated
  USING (es_mi_mascota(id_mascota)) WITH CHECK (es_mi_mascota(id_mascota));

-- ─── 6. Datos de salud: SOLO el dueño de la mascota ─────────────────────────
DO $$
DECLARE par TEXT[];
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ARRAY['MascotaVacuna', 'Id_Mascota'],
    ARRAY['Tratamiento', 'Id_Mascota'],
    ARRAY['HistorialEvento', 'Id_Mascota'],
    ARRAY['historial_peso', 'mascota_id'],
    ARRAY['consultas_veterinarias', 'mascota_id'],
    ARRAY['eventos_calendario', 'mascota_id'],
    ARRAY['mascota_estado_historial', 'id_mascota']
  ] LOOP
    EXECUTE format(
      'CREATE POLICY salud_solo_dueno ON public.%I FOR ALL TO authenticated USING (es_mi_mascota(%I)) WITH CHECK (es_mi_mascota(%I))',
      par[1], par[2], par[2]);
  END LOOP;
END $$;

-- ─── 7. Tablas "mías" (una columna dice de quién es la fila) ────────────────
DO $$
DECLARE par TEXT[];
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ARRAY['emergency_contacts', 'user_id'],
    ARRAY['sos_events', 'user_id'],
    ARRAY['usuarios_bloqueados', 'usuario_id'],
    ARRAY['user_settings', 'user_id'],
    ARRAY['blocked_users', 'user_id'],
    ARRAY['muted_users', 'user_id'],
    ARRAY['user_sessions', 'user_id'],
    ARRAY['app_usage_daily', 'user_id'],
    ARRAY['deletion_requests', 'user_id'],
    ARRAY['data_export_requests', 'user_id'],
    ARRAY['subscriptions', 'user_id']
  ] LOOP
    IF to_regclass('public.' || quote_ident(par[1])) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY solo_mias ON public.%I FOR ALL TO authenticated USING (%I = usuario_actual()) WITH CHECK (%I = usuario_actual())',
        par[1], par[2], par[2]);
    END IF;
  END LOOP;
END $$;

-- Registros que se escriben pero no se releen desde la app
CREATE POLICY sos_llamadas_alta ON sos_call_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = usuario_actual());
CREATE POLICY sos_llamadas_ver ON sos_call_logs FOR SELECT TO authenticated
  USING (user_id = usuario_actual());
CREATE POLICY reportes_alta ON reportes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = usuario_actual());

-- ─── 8. Notificaciones ──────────────────────────────────────────────────────
-- Las crea quien genera el evento (el paseador avisa al dueño, etc.): se
-- puede insertar para otro, pero sólo el destinatario las lee y las marca.
CREATE POLICY notif_ver ON "Notificacion" FOR SELECT TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY notif_marcar ON "Notificacion" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY notif_borrar ON "Notificacion" FOR DELETE TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY notif_crear ON "Notificacion" FOR INSERT TO authenticated
  WITH CHECK (usuario_actual() IS NOT NULL);

-- ─── 9. Social: publicaciones, comentarios, carteles, amistades, ubicación ──
CREATE POLICY publicacion_ver ON "Publicacion" FOR SELECT TO authenticated USING (true);
CREATE POLICY publicacion_mias ON "Publicacion" FOR ALL TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());

CREATE POLICY comentario_ver ON "Comentario" FOR SELECT TO authenticated USING (true);
CREATE POLICY comentario_mios ON "Comentario" FOR ALL TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());

CREATE POLICY carteles_ver ON carteles FOR SELECT TO authenticated USING (true);
CREATE POLICY carteles_mios ON carteles FOR ALL TO authenticated
  USING (usuario_id = usuario_actual()) WITH CHECK (usuario_id = usuario_actual());

CREATE POLICY amistades_participantes ON amistades FOR SELECT TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id));
CREATE POLICY amistades_pedir ON amistades FOR INSERT TO authenticated
  WITH CHECK (usuario_a_id = usuario_actual() AND usuario_b_id <> usuario_actual());
CREATE POLICY amistades_responder ON amistades FOR UPDATE TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id))
  WITH CHECK (usuario_actual() IN (usuario_a_id, usuario_b_id));
CREATE POLICY amistades_borrar ON amistades FOR DELETE TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id));

-- La ubicación exacta sólo la ven mis amigos, y sólo si elegí compartirla.
CREATE POLICY ubicacion_ver ON ubicaciones_usuarios FOR SELECT TO authenticated
  USING (usuario_id = usuario_actual() OR (compartir_ubicacion AND son_amigos(usuario_id)));
CREATE POLICY ubicacion_mia ON ubicaciones_usuarios FOR ALL TO authenticated
  USING (usuario_id = usuario_actual()) WITH CHECK (usuario_id = usuario_actual());

-- ─── 10. Match, votos y mensajes ────────────────────────────────────────────
CREATE POLICY voto_ver ON "Voto" FOR SELECT TO authenticated
  USING (es_mi_mascota("idMascotaOrigen") OR es_mi_mascota("idMascotaDestino"));
CREATE POLICY voto_mio ON "Voto" FOR INSERT TO authenticated
  WITH CHECK (es_mi_mascota("idMascotaOrigen"));
CREATE POLICY voto_borrar ON "Voto" FOR DELETE TO authenticated
  USING (es_mi_mascota("idMascotaOrigen"));

-- Los Match los crea SOLO la base (votar_mascota en 062), nunca el cliente.
CREATE POLICY match_ver ON "Match" FOR SELECT TO authenticated
  USING (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"));
CREATE POLICY match_desactivar ON "Match" FOR UPDATE TO authenticated
  USING (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"))
  WITH CHECK (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"));
REVOKE INSERT, DELETE ON "Match" FROM authenticated;

-- Mensaje: chat de un Match, o chat cliente ↔ negocio (idServicio).
-- En el chat de negocio, "idUsuario" es SIEMPRE el cliente y deNegocio dice
-- quién escribió.
CREATE POLICY mensaje_ver ON "Mensaje" FOR SELECT TO authenticated USING (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch"))
  OR ("idServicio" IS NOT NULL AND ("idUsuario" = usuario_actual() OR soy_dueno_servicio("idServicio")))
);
CREATE POLICY mensaje_enviar ON "Mensaje" FOR INSERT TO authenticated WITH CHECK (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch") AND "idUsuario" = usuario_actual())
  OR ("idServicio" IS NOT NULL AND (
        ("idUsuario" = usuario_actual() AND NOT "deNegocio")
        OR ("deNegocio" AND soy_dueno_servicio("idServicio"))))
);
CREATE POLICY mensaje_marcar_leido ON "Mensaje" FOR UPDATE TO authenticated USING (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch"))
  OR ("idServicio" IS NOT NULL AND ("idUsuario" = usuario_actual() OR soy_dueno_servicio("idServicio")))
);

-- ─── 11. Paseos ─────────────────────────────────────────────────────────────
CREATE POLICY paseador_perfil_ver ON paseador_perfil FOR SELECT TO authenticated USING (true);
CREATE POLICY paseador_perfil_mio ON paseador_perfil FOR ALL TO authenticated
  USING (id_user = usuario_actual()) WITH CHECK (id_user = usuario_actual());

CREATE POLICY paseador_opiniones_ver ON paseador_opiniones FOR SELECT TO authenticated USING (true);
CREATE POLICY paseador_opiniones_mias ON paseador_opiniones FOR ALL TO authenticated
  USING (id_autor = usuario_actual()) WITH CHECK (id_autor = usuario_actual());

-- Un paseo lo ven el dueño y el paseador. Las solicitudes ABIERTAS (sin
-- paseador asignado) las ven los paseadores, para poder tomarlas.
CREATE POLICY paseo_ver ON "Paseo" FOR SELECT TO authenticated USING (
  usuario_actual() IN ("Id_Dueno", "Id_Walker")
  OR ("Id_Walker" IS NULL AND "Estado" = 'pendiente' AND soy_paseador())
);
CREATE POLICY paseo_pedir ON "Paseo" FOR INSERT TO authenticated
  WITH CHECK ("Id_Dueno" = usuario_actual() AND es_mi_mascota("Id_Mascota"));
-- Qué transición puede hacer cada uno lo controla el trigger de 062.
CREATE POLICY paseo_actualizar ON "Paseo" FOR UPDATE TO authenticated
  USING (usuario_actual() IN ("Id_Dueno", "Id_Walker"))
  WITH CHECK (usuario_actual() IN ("Id_Dueno", "Id_Walker"));
REVOKE DELETE ON "Paseo" FROM authenticated;

CREATE POLICY track_ver ON "PaseoTrack" FOR SELECT TO authenticated
  USING (participo_en_paseo("Id_Paseo"));
CREATE POLICY track_registrar ON "PaseoTrack" FOR INSERT TO authenticated
  WITH CHECK (soy_walker_de_paseo("Id_Paseo"));

CREATE POLICY paseo_mensajes_ver ON paseo_mensajes FOR SELECT TO authenticated
  USING (participo_en_paseo(id_paseo));
CREATE POLICY paseo_mensajes_enviar ON paseo_mensajes FOR INSERT TO authenticated
  WITH CHECK (id_user = usuario_actual() AND participo_en_paseo(id_paseo));
CREATE POLICY paseo_mensajes_leer ON paseo_mensajes FOR UPDATE TO authenticated
  USING (participo_en_paseo(id_paseo)) WITH CHECK (participo_en_paseo(id_paseo));

CREATE POLICY paseo_rechazos_mios ON paseo_rechazos FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

CREATE POLICY pagos_ver ON paseo_pagos FOR SELECT TO authenticated
  USING (usuario_actual() IN (id_walker, id_dueno));
CREATE POLICY pagos_registra_paseador ON paseo_pagos FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

CREATE POLICY cuenta_config_ver ON paseo_cuenta_config FOR SELECT TO authenticated
  USING (usuario_actual() IN (id_walker, id_dueno));
CREATE POLICY cuenta_config_paseador ON paseo_cuenta_config FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

-- ─── 12. Negocios ───────────────────────────────────────────────────────────
CREATE POLICY negocio_ver ON negocio_perfil FOR SELECT TO authenticated USING (true);
CREATE POLICY negocio_mio ON negocio_perfil FOR UPDATE TO authenticated
  USING (id_user = usuario_actual()) WITH CHECK (id_user = usuario_actual());

CREATE POLICY servicios_ver ON servicios FOR SELECT TO authenticated USING (true);
CREATE POLICY servicios_de_mi_negocio ON servicios FOR UPDATE TO authenticated
  USING (soy_dueno_negocio(id_negocio)) WITH CHECK (soy_dueno_negocio(id_negocio));

CREATE POLICY items_ver ON negocio_items FOR SELECT TO authenticated USING (true);
CREATE POLICY items_de_mi_negocio ON negocio_items FOR ALL TO authenticated
  USING (soy_dueno_negocio(id_negocio)) WITH CHECK (soy_dueno_negocio(id_negocio));

-- Turnos y pedidos: los ven el cliente y el negocio. Precio, total y stock los
-- calcula la base (triggers de 062): lo que mande el cliente se recalcula.
CREATE POLICY turnos_ver ON negocio_turnos FOR SELECT TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
CREATE POLICY turnos_pedir ON negocio_turnos FOR INSERT TO authenticated
  WITH CHECK (id_dueno = usuario_actual()
              AND (id_mascota IS NULL OR es_mi_mascota(id_mascota)));
CREATE POLICY turnos_actualizar ON negocio_turnos FOR UPDATE TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio))
  WITH CHECK (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));

CREATE POLICY pedidos_ver ON negocio_pedidos FOR SELECT TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
CREATE POLICY pedidos_hacer ON negocio_pedidos FOR INSERT TO authenticated
  WITH CHECK (id_dueno = usuario_actual());
CREATE POLICY pedidos_actualizar ON negocio_pedidos FOR UPDATE TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio))
  WITH CHECK (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
REVOKE DELETE ON negocio_turnos, negocio_pedidos FROM authenticated;

-- ─── 13. Roles ──────────────────────────────────────────────────────────────
-- Se pueden leer (la app decide a qué pantalla ir), nunca escribir desde el
-- cliente: los asignan las RPC de alta.
CREATE POLICY roles_ver ON "UserRole" FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON "UserRole" FROM authenticated;

-- ─── 14. Las RPC viejas de contraseña quedan sólo para el servidor ──────────
-- login_user / registrar_* con p_hash comparaban un SHA-256 sin sal que
-- mandaba el cliente. Con Supabase Auth ya no hacen falta; se dejan de
-- exponer (la Edge Function migrar-cuenta no las usa).
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'login_user(text, text)',
    'registrar_usuario_con_mascota(jsonb, text, jsonb)',
    'registrar_paseador(jsonb, text, jsonb)',
    'activar_paseador(text, text, jsonb)',
    'registrar_negocio(jsonb, text, jsonb)',
    'activar_negocio(text, text, jsonb)',
    'cambiar_contrasena(text, text, text)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      NULL; -- esa versión de la función no existe en esta base
    END;
  END LOOP;
END $$;

-- Documentación viva de qué es cada tabla (la consulta el README)
INSERT INTO zooni_politica_tablas (tabla, categoria, motivo) VALUES
  ('razas', 'catalogo', 'Lectura pública: lo usa el registro antes de tener sesión'),
  ('User', 'privada', 'Sólo la fila propia; lo de otros, por la vista perfil_publico'),
  ('Mascota', 'social', 'Se ven entre usuarios; sólo el dueño escribe'),
  ('MascotaVacuna', 'salud', 'Sólo el dueño de la mascota'),
  ('consultas_veterinarias', 'salud', 'Sólo el dueño de la mascota'),
  ('Paseo', 'compartida', 'Dueño y paseador; transiciones validadas por trigger'),
  ('negocio_pedidos', 'compartida', 'Cliente y negocio; total y stock los calcula la base'),
  ('user_credentials', 'interna', 'Hashes viejos; se vacía a medida que se migra a Supabase Auth')
ON CONFLICT (tabla) DO UPDATE SET categoria = EXCLUDED.categoria, motivo = EXCLUDED.motivo;

NOTIFY pgrst, 'reload schema';

-- ─── 15. Contexto médico de ZooniVet: sólo para la Edge Function ────────────
-- get_pet_chat_context (051) es SECURITY DEFINER y recibe un petId: si la
-- pudiera llamar cualquiera, cualquiera leería el contexto médico de cualquier
-- mascota. La usa únicamente zoonivet-chat (con service_role), DESPUÉS de
-- comprobar con el JWT que la mascota es de quien pregunta.
REVOKE ALL ON FUNCTION get_pet_chat_context(BIGINT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pet_chat_context(BIGINT) TO service_role;

NOTIFY pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 062_reglas_negocio.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- 062_reglas_negocio.sql — La base es la fuente de verdad de lo que mueve plata.
-- Idempotente. Requiere 035, 040, 045, 046, 060.
-- =============================================================================
-- ANTES: el total de un pedido, el descuento de stock, el precio y la comisión
-- de un paseo y la disponibilidad de un turno los calculaba la app, y la base
-- guardaba lo que recibía. Problemas:
--   · Con la clave pública cualquiera podía insertar un pedido con total $1.
--   · "Leer → decidir en el cliente → escribir" (check-then-act): dos clientes
--     que piden el último producto a la vez pasaban los dos el chequeo; dos
--     dueños podían reservar el mismo horario; un paseo se podía finalizar dos
--     veces.
--
-- AHORA las reglas viven acá, en triggers y funciones que corren dentro de la
-- misma transacción que la escritura:
--   · Pedidos: el trigger relee precios del catálogo, recalcula subtotal,
--     envío y total, y RESERVA el stock en el mismo INSERT (SELECT … FOR UPDATE
--     bloquea la fila del producto: el segundo pedido espera y ve el stock ya
--     descontado). Si el pedido se rechaza o cancela, el stock vuelve.
--   · Turnos: un candado por negocio (pg_advisory_xact_lock) serializa las
--     reservas, así el chequeo de superposición no tiene carrera. El precio
--     tiene que ser uno de los del servicio (más el recargo a domicilio).
--   · Paseos: el precio sale del perfil del paseador; las transiciones de
--     estado están en una tabla de reglas (quién puede pasar de qué a qué).
--     Finalizar dos veces es imposible: 'finalizado' → 'finalizado' no
--     recalcula nada.
--   · Match: votar_mascota() guarda el voto y, si hay "me gusta" recíproco,
--     crea el Match y las notificaciones en la misma transacción.
--
-- Es el mismo patrón que ya usaba aceptar_solicitud_paseo (035): que la base
-- decida quién gana. La app sigue validando para dar buenos mensajes, pero ya
-- no es la que garantiza.
-- =============================================================================

-- ─── 0. Constraints ─────────────────────────────────────────────────────────
-- NOT VALID: no revisa filas viejas (podría haber stock negativo histórico),
-- pero sí todas las escrituras nuevas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negocio_items_stock_no_negativo') THEN
    ALTER TABLE negocio_items ADD CONSTRAINT negocio_items_stock_no_negativo
      CHECK (stock IS NULL OR stock >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negocio_pedidos_total_cuadra') THEN
    ALTER TABLE negocio_pedidos ADD CONSTRAINT negocio_pedidos_total_cuadra
      CHECK (total = subtotal + envio AND subtotal >= 0 AND envio >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paseo_precio_positivo') THEN
    ALTER TABLE "Paseo" ADD CONSTRAINT paseo_precio_positivo
      CHECK ("Precio" >= 0 AND "Comision" >= 0) NOT VALID;
  END IF;
END $$;

-- Número de un jsonb que puede venir vacío o como texto ('' → NULL)
CREATE OR REPLACE FUNCTION _num(p JSONB)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL OR jsonb_typeof(p) = 'null' THEN NULL
              WHEN jsonb_typeof(p) = 'number' THEN (p #>> '{}')::NUMERIC
              ELSE NULLIF(trim(p #>> '{}'), '')::NUMERIC END
$$;

-- ─── 1. PASEOS ──────────────────────────────────────────────────────────────

-- Comisión de Zooni por paseo (0,10 = 10 %). Hoy 0: el modelo de cobro todavía
-- no está definido. Cambiarla acá la cambia para todos los paseos que se
-- finalicen desde ese momento; los ya finalizados conservan la suya.
CREATE OR REPLACE FUNCTION comision_zooni()
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$ SELECT 0::NUMERIC $$;

-- Precio que cobra un paseador por un paseo de N minutos (NULL si no lo ofrece).
-- Misma regla que precioPara() de la app (src/domain/paseos.js).
CREATE OR REPLACE FUNCTION precio_paseo(p_walker INTEGER, p_minutos INTEGER)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (SELECT * FROM paseador_perfil WHERE id_user = p_walker),
  lista AS (
    SELECT _num(x->'minutos') AS minutos, _num(x->'precio') AS precio
    FROM p, jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.servicios) = 'array' AND jsonb_array_length(p.servicios) > 0
           THEN p.servicios
           ELSE jsonb_build_array(
             jsonb_build_object('minutos', 30, 'precio', p.precio_30),
             jsonb_build_object('minutos', 60, 'precio', p.precio_60))
      END) x
  )
  SELECT precio FROM lista WHERE minutos = p_minutos AND precio > 0 LIMIT 1
$$;

CREATE OR REPLACE FUNCTION _paseo_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_precio NUMERIC;
BEGIN
  NEW."Estado" := 'pendiente';
  NEW."Comision" := 0;
  NEW."HoraInicio" := NULL;
  NEW."HoraFin" := NULL;
  IF NEW."Id_Walker" IS NOT NULL THEN
    v_precio := precio_paseo(NEW."Id_Walker", NEW."DuracionMin");
    IF v_precio IS NULL THEN RAISE EXCEPTION 'servicio_inexistente'; END IF;
    NEW."Precio" := v_precio;   -- lo que mande el cliente no cuenta
  END IF;
  IF NEW."Precio" IS NULL OR NEW."Precio" <= 0 THEN RAISE EXCEPTION 'precio_invalido'; END IF;
  NEW."PrecioPactado" := NEW."Precio";
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_paseo_al_crear ON "Paseo";
CREATE TRIGGER trg_paseo_al_crear BEFORE INSERT ON "Paseo"
  FOR EACH ROW EXECUTE FUNCTION _paseo_al_crear();

-- Quién puede mover un paseo de un estado a otro.
--   rol 'walker' = el paseador asignado (o el que lo toma, al aceptar)
--   rol 'dueno'  = el dueño de la mascota
CREATE TABLE IF NOT EXISTS paseo_transiciones (
  desde TEXT NOT NULL,
  hasta TEXT NOT NULL,
  rol   TEXT NOT NULL CHECK (rol IN ('walker', 'dueno')),
  PRIMARY KEY (desde, hasta, rol)
);
INSERT INTO paseo_transiciones (desde, hasta, rol) VALUES
  ('pendiente',  'aceptado',   'walker'),
  ('pendiente',  'rechazado',  'walker'),
  ('pendiente',  'cancelado',  'dueno'),
  ('aceptado',   'cancelado',  'dueno'),
  ('aceptado',   'cancelado',  'walker'),
  ('aceptado',   'en_curso',   'walker'),
  ('en_curso',   'finalizado', 'walker'),
  ('finalizado', 'en_curso',   'walker')   -- "retomar", sólo 15 min (ver trigger)
ON CONFLICT DO NOTHING;
ALTER TABLE paseo_transiciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalogo_lectura ON paseo_transiciones;
CREATE POLICY catalogo_lectura ON paseo_transiciones FOR SELECT TO authenticated USING (true);
GRANT SELECT ON paseo_transiciones TO authenticated;

CREATE OR REPLACE FUNCTION _paseo_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_rol TEXT;
BEGIN
  -- Partes y precio pactado no se cambian por UPDATE (nunca)
  NEW."Id_Dueno" := OLD."Id_Dueno";
  NEW."Id_Mascota" := OLD."Id_Mascota";
  NEW."PrecioPactado" := COALESCE(OLD."PrecioPactado", OLD."Precio");

  -- Sin JWT (service_role / mantenimiento desde el SQL Editor): sin reglas de rol
  IF v_yo IS NOT NULL THEN
    v_rol := CASE
      WHEN v_yo = OLD."Id_Dueno" THEN 'dueno'
      WHEN v_yo = OLD."Id_Walker" OR (OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = v_yo) THEN 'walker'
    END;
    IF v_rol IS NULL THEN RAISE EXCEPTION 'sin_permiso'; END IF;

    -- El paseador sólo cambia cuando alguien TOMA una solicitud
    IF NEW."Id_Walker" IS DISTINCT FROM OLD."Id_Walker"
       AND NOT (OLD."Estado" = 'pendiente' AND NEW."Estado" = 'aceptado' AND NEW."Id_Walker" = v_yo) THEN
      RAISE EXCEPTION 'transicion_invalida';
    END IF;

    IF NEW."Estado" IS DISTINCT FROM OLD."Estado" THEN
      IF NOT EXISTS (SELECT 1 FROM paseo_transiciones
                     WHERE desde = OLD."Estado" AND hasta = NEW."Estado" AND rol = v_rol) THEN
        RAISE EXCEPTION 'transicion_invalida';
      END IF;
      IF OLD."Estado" = 'finalizado'
         AND (OLD."HoraFin" IS NULL OR OLD."HoraFin" < now() - interval '15 minutes') THEN
        RAISE EXCEPTION 'ya_no_se_puede_retomar';
      END IF;
    END IF;

    -- La reseña la escribe sólo el dueño; el recorrido, sólo el paseador
    IF v_rol <> 'dueno' THEN
      NEW."Rating" := OLD."Rating";
      NEW."Resena" := OLD."Resena";
      NEW."ResenaAspectos" := OLD."ResenaAspectos";
      NEW."ResenaRespuestas" := OLD."ResenaRespuestas";
      NEW."ResenaMedia" := OLD."ResenaMedia";
      NEW."ResenaFecha" := OLD."ResenaFecha";
    ELSE
      NEW."HoraInicio" := OLD."HoraInicio";
      NEW."ReanudadoEn" := OLD."ReanudadoEn";
      NEW."SegundosAcumulados" := OLD."SegundosAcumulados";
      NEW."DistanciaMetros" := OLD."DistanciaMetros";
    END IF;
  END IF;

  -- Plata: se calcula acá, una sola vez, al pasar a 'finalizado'
  IF NEW."Estado" = 'finalizado' AND OLD."Estado" IS DISTINCT FROM 'finalizado' THEN
    NEW."Precio" := NEW."PrecioPactado";
    NEW."Comision" := round(NEW."Precio" * comision_zooni(), 2);
    NEW."HoraFin" := now();
  ELSIF NEW."Estado" = 'finalizado' THEN
    -- Ya estaba finalizado (ej. el dueño deja la reseña): nada de plata cambia
    NEW."Precio" := OLD."Precio";
    NEW."Comision" := OLD."Comision";
    NEW."HoraFin" := OLD."HoraFin";
  ELSE
    NEW."Precio" := NEW."PrecioPactado";
    NEW."Comision" := 0;
    IF OLD."Estado" = 'finalizado' THEN NEW."HoraFin" := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_paseo_al_actualizar ON "Paseo";
CREATE TRIGGER trg_paseo_al_actualizar BEFORE UPDATE ON "Paseo"
  FOR EACH ROW EXECUTE FUNCTION _paseo_al_actualizar();

-- aceptar_solicitud_paseo (035) recibía el id del paseador desde el cliente.
-- Ahora el paseador es el de la sesión; p_id_walker queda por compatibilidad
-- y tiene que coincidir.
CREATE OR REPLACE FUNCTION aceptar_solicitud_paseo(p_id_paseo INTEGER, p_id_walker INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_walker INTEGER := usuario_actual();
  v_filas INTEGER;
BEGIN
  IF v_walker IS NULL THEN RAISE EXCEPTION 'sin_sesion'; END IF;
  IF p_id_walker IS NOT NULL AND p_id_walker <> v_walker THEN RAISE EXCEPTION 'sin_permiso'; END IF;
  IF NOT EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = v_walker) THEN
    RAISE EXCEPTION 'no_es_paseador';
  END IF;

  -- El WHERE con el estado es la cerradura: si dos aceptan a la vez, la fila
  -- se actualiza una sola vez.
  UPDATE "Paseo"
  SET "Estado" = 'aceptado', "Id_Walker" = v_walker
  WHERE "Id_Paseo" = p_id_paseo
    AND "Estado" = 'pendiente'
    AND ("Id_Walker" IS NULL OR "Id_Walker" = v_walker);

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas = 1;
END $$;

REVOKE ALL ON FUNCTION aceptar_solicitud_paseo(INTEGER, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION aceptar_solicitud_paseo(INTEGER, INTEGER) TO authenticated;

-- ─── 2. PEDIDOS (pet shop) ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _pedido_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg negocio_perfil%ROWTYPE;
  v_linea RECORD;
  v_it negocio_items%ROWTYPE;
  v_items JSONB := '[]'::JSONB;
  v_sub NUMERIC := 0;
  v_envio NUMERIC := 0;
  v_minimo NUMERIC;
  v_gratis NUMERIC;
  v_sin_stock TEXT[] := '{}';
BEGIN
  SELECT * INTO v_neg FROM negocio_perfil WHERE id = NEW.id_negocio;
  IF NOT FOUND THEN RAISE EXCEPTION 'negocio_inexistente'; END IF;
  IF v_neg.abierto IS FALSE THEN RAISE EXCEPTION 'negocio_cerrado'; END IF;
  IF jsonb_typeof(NEW.items) <> 'array' THEN RAISE EXCEPTION 'carrito_vacio'; END IF;

  -- Una línea por producto (ordenadas por id: siempre se bloquean en el
  -- mismo orden, así dos pedidos simultáneos no se trancan entre sí)
  FOR v_linea IN
    SELECT (x->>'idItem')::INTEGER AS id, sum(_num(x->'cantidad'))::INTEGER AS cantidad
    FROM jsonb_array_elements(NEW.items) x
    GROUP BY 1 ORDER BY 1
  LOOP
    IF v_linea.cantidad IS NULL OR v_linea.cantidad <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_it FROM negocio_items
    WHERE id = v_linea.id AND id_negocio = NEW.id_negocio
    FOR UPDATE;

    IF NOT FOUND OR NOT v_it.activo OR (v_it.stock IS NOT NULL AND v_it.stock < v_linea.cantidad) THEN
      v_sin_stock := v_sin_stock || COALESCE(v_it.nombre, v_linea.id::TEXT);
      CONTINUE;
    END IF;

    IF v_it.stock IS NOT NULL THEN
      UPDATE negocio_items SET stock = stock - v_linea.cantidad WHERE id = v_it.id;
    END IF;

    v_items := v_items || jsonb_build_object(
      'idItem', v_it.id, 'nombre', v_it.nombre, 'precio', v_it.precio, 'cantidad', v_linea.cantidad);
    v_sub := v_sub + v_it.precio * v_linea.cantidad;
  END LOOP;

  IF array_length(v_sin_stock, 1) > 0 THEN
    RAISE EXCEPTION 'sin_stock' USING DETAIL = array_to_string(v_sin_stock, ', ');
  END IF;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'carrito_vacio'; END IF;

  v_minimo := COALESCE(_num(v_neg.datos->'pedidoMinimo'), 0);
  IF v_minimo > 0 AND v_sub < v_minimo THEN RAISE EXCEPTION 'pedido_minimo'; END IF;

  IF NEW.entrega = 'envio' THEN
    IF COALESCE((v_neg.datos->>'envios')::BOOLEAN, FALSE) IS FALSE THEN
      RAISE EXCEPTION 'sin_envios';
    END IF;
    v_gratis := COALESCE(_num(v_neg.datos->'envioGratisDesde'), 0);
    v_envio := CASE WHEN v_gratis > 0 AND v_sub >= v_gratis THEN 0
                    ELSE COALESCE(_num(v_neg.datos->'envioCosto'), 0) END;
  ELSE
    NEW.direccion := NULL;
  END IF;

  NEW.items := v_items;
  NEW.subtotal := round(v_sub, 2);
  NEW.envio := round(v_envio, 2);
  NEW.total := round(v_sub, 2) + round(v_envio, 2);
  NEW.estado := 'nuevo';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pedido_al_crear ON negocio_pedidos;
CREATE TRIGGER trg_pedido_al_crear BEFORE INSERT ON negocio_pedidos
  FOR EACH ROW EXECUTE FUNCTION _pedido_al_crear();

CREATE OR REPLACE FUNCTION _devolver_stock(p_items JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE negocio_items i
  SET stock = i.stock + l.cantidad
  FROM (SELECT (x->>'idItem')::INTEGER AS id, sum(_num(x->'cantidad'))::INTEGER AS cantidad
        FROM jsonb_array_elements(p_items) x GROUP BY 1) l
  WHERE i.id = l.id AND i.stock IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION _pedido_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_negocio BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  -- Lo que se compró y cuánto sale queda fijo desde que se creó
  NEW.items := OLD.items;
  NEW.subtotal := OLD.subtotal;
  NEW.envio := OLD.envio;
  NEW.total := OLD.total;
  NEW.id_dueno := OLD.id_dueno;
  NEW.id_negocio := OLD.id_negocio;
  NEW.entrega := OLD.entrega;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

  v_negocio := v_yo IS NULL OR soy_dueno_negocio(OLD.id_negocio);
  v_ok := CASE
    WHEN OLD.estado = 'nuevo'      AND NEW.estado IN ('preparando', 'rechazado') THEN v_negocio
    WHEN OLD.estado = 'nuevo'      AND NEW.estado = 'cancelado' THEN v_yo IS NULL OR v_yo = OLD.id_dueno
    WHEN OLD.estado = 'preparando' AND NEW.estado = 'en_camino' THEN v_negocio AND OLD.entrega = 'envio'
    WHEN OLD.estado = 'preparando' AND NEW.estado = 'listo'     THEN v_negocio AND OLD.entrega <> 'envio'
    WHEN OLD.estado IN ('preparando', 'listo') AND NEW.estado = 'cancelado' THEN v_negocio
    WHEN OLD.estado IN ('listo', 'en_camino')  AND NEW.estado = 'entregado' THEN v_negocio
    ELSE FALSE
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'transicion_invalida'; END IF;

  -- El stock se reservó al crear el pedido: si no se concreta, vuelve.
  IF NEW.estado IN ('rechazado', 'cancelado') THEN
    PERFORM _devolver_stock(OLD.items);
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pedido_al_actualizar ON negocio_pedidos;
CREATE TRIGGER trg_pedido_al_actualizar BEFORE UPDATE ON negocio_pedidos
  FOR EACH ROW EXECUTE FUNCTION _pedido_al_actualizar();

-- ─── 3. TURNOS (veterinaria / peluquería) ───────────────────────────────────

CREATE OR REPLACE FUNCTION _turno_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg negocio_perfil%ROWTYPE;
  v_item negocio_items%ROWTYPE;
  v_recargo NUMERIC := 0;
  v_validos NUMERIC[];
BEGIN
  SELECT * INTO v_neg FROM negocio_perfil WHERE id = NEW.id_negocio;
  IF NOT FOUND THEN RAISE EXCEPTION 'negocio_inexistente'; END IF;
  IF v_neg.abierto IS FALSE THEN RAISE EXCEPTION 'negocio_cerrado'; END IF;

  SELECT * INTO v_item FROM negocio_items
  WHERE id = NEW.id_item AND id_negocio = NEW.id_negocio AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'servicio_inexistente'; END IF;

  NEW.servicio := v_item.nombre;
  NEW.duracion_min := COALESCE(v_item.duracion_min, NEW.duracion_min);
  NEW.estado := 'pendiente';
  NEW.informe := NULL;

  -- Un turno a la vez por negocio: el segundo espera acá hasta que el primero
  -- termine su transacción, y entonces SÍ ve el turno recién guardado.
  PERFORM pg_advisory_xact_lock(hashtext('zooni_turnos'), NEW.id_negocio);
  IF EXISTS (
    SELECT 1 FROM negocio_turnos t
    WHERE t.id_negocio = NEW.id_negocio
      AND t.estado IN ('pendiente', 'confirmado')
      AND tstzrange(t.fecha, t.fecha + make_interval(mins => t.duracion_min))
          && tstzrange(NEW.fecha, NEW.fecha + make_interval(mins => NEW.duracion_min))
  ) THEN
    RAISE EXCEPTION 'horario_ocupado';
  END IF;

  -- Precio: alguno de los del servicio (por tamaño, o el base) + recargo
  IF NEW.a_domicilio AND v_neg.tipo = 'peluqueria' THEN
    v_recargo := COALESCE(_num(v_neg.datos->'buscaYLlevaCosto'), 0);
  END IF;
  v_validos := ARRAY[round(v_item.precio, 2)];
  IF jsonb_typeof(v_item.precios) = 'object' THEN
    v_validos := v_validos || ARRAY(
      SELECT round(_num(v), 2) FROM jsonb_each(v_item.precios) AS e(k, v) WHERE _num(v) > 0);
  END IF;
  IF NOT (round(NEW.precio - v_recargo, 2) = ANY (v_validos)) THEN
    RAISE EXCEPTION 'precio_invalido';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_turno_al_crear ON negocio_turnos;
CREATE TRIGGER trg_turno_al_crear BEFORE INSERT ON negocio_turnos
  FOR EACH ROW EXECUTE FUNCTION _turno_al_crear();

CREATE OR REPLACE FUNCTION _turno_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_negocio BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  NEW.precio := OLD.precio;
  NEW.id_dueno := OLD.id_dueno;
  NEW.id_negocio := OLD.id_negocio;
  NEW.id_item := OLD.id_item;

  v_negocio := v_yo IS NULL OR soy_dueno_negocio(OLD.id_negocio);
  IF NOT v_negocio THEN
    NEW.informe := OLD.informe;   -- el informe lo escribe sólo el negocio
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

  v_ok := CASE
    WHEN OLD.estado = 'pendiente'  AND NEW.estado IN ('confirmado', 'rechazado') THEN v_negocio
    WHEN OLD.estado = 'confirmado' AND NEW.estado IN ('completado', 'ausente')   THEN v_negocio
    WHEN OLD.estado IN ('pendiente', 'confirmado') AND NEW.estado = 'cancelado'
      THEN v_negocio OR v_yo = OLD.id_dueno
    ELSE FALSE
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'transicion_invalida'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_turno_al_actualizar ON negocio_turnos;
CREATE TRIGGER trg_turno_al_actualizar BEFORE UPDATE ON negocio_turnos
  FOR EACH ROW EXECUTE FUNCTION _turno_al_actualizar();

-- ─── 4. MATCH ───────────────────────────────────────────────────────────────
-- Responde la pregunta "¿qué pasa exactamente cuando dos 'me gusta'
-- coinciden?": 1) se guarda el voto, 2) si el otro ya había votado que sí, se
-- crea el Match (una sola vez: UNIQUE + ON CONFLICT), 3) se notifica a los dos.
-- Todo en una transacción: o pasa todo, o nada.
CREATE OR REPLACE FUNCTION votar_mascota(p_origen INTEGER, p_destino INTEGER, p_le_gusta BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_mia "Mascota"%ROWTYPE;
  v_otra "Mascota"%ROWTYPE;
  v_match_id INTEGER;
  v_otro_nombre TEXT;
  v_otro_foto TEXT;
  v_mi_nombre TEXT;
  v_mi_foto TEXT;
BEGIN
  SELECT * INTO v_mia FROM "Mascota" WHERE "Id_Mascota" = p_origen AND "Id_User" = v_yo;
  IF NOT FOUND THEN RAISE EXCEPTION 'sin_permiso'; END IF;
  SELECT * INTO v_otra FROM "Mascota" WHERE "Id_Mascota" = p_destino;
  IF NOT FOUND OR v_otra."Id_User" = v_yo THEN RAISE EXCEPTION 'mascota_invalida'; END IF;

  INSERT INTO "Voto" ("idMascotaOrigen", "idMascotaDestino", "leGusta", fecha)
  VALUES (p_origen, p_destino, p_le_gusta, now())
  ON CONFLICT ("idMascotaOrigen", "idMascotaDestino")
  DO UPDATE SET "leGusta" = EXCLUDED."leGusta", fecha = EXCLUDED.fecha;

  IF NOT p_le_gusta OR NOT EXISTS (
    SELECT 1 FROM "Voto"
    WHERE "idMascotaOrigen" = p_destino AND "idMascotaDestino" = p_origen AND "leGusta"
  ) THEN
    RETURN jsonb_build_object('match', FALSE);
  END IF;

  -- El par se guarda siempre ordenado (menor, mayor): así el UNIQUE impide
  -- que A→B y B→A creen dos Match distintos.
  INSERT INTO "Match" ("idMascotaUno", "idMascotaDos", "idUsuarioUno", "idUsuarioDos")
  SELECT least(p_origen, p_destino), greatest(p_origen, p_destino),
         CASE WHEN p_origen < p_destino THEN v_yo ELSE v_otra."Id_User" END,
         CASE WHEN p_origen < p_destino THEN v_otra."Id_User" ELSE v_yo END
  ON CONFLICT ("idMascotaUno", "idMascotaDos") DO NOTHING
  RETURNING id INTO v_match_id;

  IF v_match_id IS NULL THEN
    -- Ya existía (ej. match viejo guardado en el otro orden)
    SELECT id INTO v_match_id FROM "Match"
    WHERE ("idMascotaUno", "idMascotaDos") IN ((p_origen, p_destino), (p_destino, p_origen))
    LIMIT 1;
  ELSE
    SELECT "Nombre", "FotoPerfil" INTO v_otro_nombre, v_otro_foto FROM "User" WHERE "Id_User" = v_otra."Id_User";
    SELECT "Nombre", "FotoPerfil" INTO v_mi_nombre, v_mi_foto FROM "User" WHERE "Id_User" = v_yo;
    INSERT INTO "Notificacion" ("Id_User", "Id_Mascota", "Titulo", "Mensaje", "Tipo", "Leido", "Fecha", "DataExtra")
    VALUES
      (v_yo, p_origen, '¡Nuevo match!', v_mia."Nombre" || ' hizo match con ' || v_otra."Nombre", 'match', FALSE, now(),
       jsonb_build_object('chatId', v_match_id, 'nombre', COALESCE(v_otro_nombre, 'Usuario'), 'fotoPerfilUrl', v_otro_foto)),
      (v_otra."Id_User", p_destino, '¡Nuevo match!', v_otra."Nombre" || ' hizo match con ' || v_mia."Nombre", 'match', FALSE, now(),
       jsonb_build_object('chatId', v_match_id, 'nombre', COALESCE(v_mi_nombre, 'Usuario'), 'fotoPerfilUrl', v_mi_foto));
  END IF;

  SELECT "Nombre", "FotoPerfil" INTO v_otro_nombre, v_otro_foto FROM "User" WHERE "Id_User" = v_otra."Id_User";
  RETURN jsonb_build_object(
    'match', TRUE, 'match_id', v_match_id, 'chat_id', v_match_id,
    'usuario_match', jsonb_build_object('nombre', COALESCE(v_otro_nombre, 'Usuario'), 'foto_perfil_url', v_otro_foto));
END $$;

REVOKE ALL ON FUNCTION votar_mascota(INTEGER, INTEGER, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION votar_mascota(INTEGER, INTEGER, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 063_storage.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- 063_storage.sql — Buckets de Storage y sus reglas, escritos en el repo.
-- Idempotente. Requiere 060.
-- =============================================================================
-- ANTES: los buckets se habían creado a mano en el dashboard y la subida
-- confiaba en lo que el cliente decía: el contentType y el tamaño los ponía
-- la app, y cualquiera con la clave pública podía subir a cualquier ruta.
--
-- AHORA:
--   · Tamaño máximo y tipos permitidos los aplica el SERVIDOR de Storage
--     (file_size_limit / allowed_mime_types): un archivo de 200 MB o un .exe
--     con contentType "image/png" se rechazan aunque la app no lo frene.
--   · Sólo se sube con sesión y SÓLO dentro de la carpeta propia:
--     <auth.uid()>/<uso>/<archivo>. Nadie puede pisar ni borrar lo de otro.
--   · Extensión del nombre en lista blanca (el nombre lo arma la app, pero se
--     revisa acá).
--
-- Pendiente conocido (no se resuelve en esta migración): las imágenes de
-- consultas veterinarias van al bucket público. Lo correcto es un bucket
-- privado con URLs firmadas; queda anotado en el README.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('public-images', 'public-images', TRUE, 5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']),
  ('resenas', 'resenas', TRUE, 50 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Empezar de cero también acá: las políticas hechas a mano no quedan.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY zooni_lectura ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('public-images', 'resenas'));

CREATE POLICY zooni_subir_a_mi_carpeta ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('public-images', 'resenas')
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND lower(storage.extension(name)) IN
        ('jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'mov', 'webm', '3gp', 'm4v')
  );

CREATE POLICY zooni_borrar_lo_mio ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('public-images', 'resenas')
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ─── Verificación final ─────────────────────────────────────────────────────
DO $verificacion$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND qual = 'true'
             AND policyname NOT IN ('catalogo_lectura', 'mascota_ver', 'mascota_fotos_ver', 'publicacion_ver',
               'comentario_ver', 'carteles_ver', 'paseador_perfil_ver', 'paseador_opiniones_ver', 'negocio_ver',
               'servicios_ver', 'items_ver', 'roles_ver')) THEN
    RAISE EXCEPTION 'Quedó una política USING true inesperada: revisá pg_policies';
  END IF;
  RAISE NOTICE 'Zooni: cambios aplicados. Políticas RLS: %', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
END
$verificacion$;

COMMIT;
