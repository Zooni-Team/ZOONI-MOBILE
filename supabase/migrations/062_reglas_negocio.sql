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
