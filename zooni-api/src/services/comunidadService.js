import pool from '../config/pgPool.js';

// ─── Mapa ─────────────────────────────────────────────────────────────────────

export async function getMapaData({ lat_min, lat_max, lng_min, lng_max }) {
  const params = [
    parseFloat(lat_min),
    parseFloat(lat_max),
    parseFloat(lng_min),
    parseFloat(lng_max),
  ];

  const [serviciosRes, cartelesRes] = await Promise.all([
    pool.query(
      `SELECT
        id_servicio AS id, tipo, nombre, direccion, telefono,
        descripcion, lat, lng, google_maps_url
       FROM servicio
       WHERE lat BETWEEN $1 AND $2
         AND lng BETWEEN $3 AND $4
       LIMIT 50`,
      params
    ),
    pool.query(
      `SELECT
        c.id_cartel AS id, c.id_user AS usuario_id, c.tipo,
        c.descripcion, c.telefono_contacto,
        c.foto_url, c.lat, c.lng, c.created_at,
        u.nombre || ' ' || u.apellido AS publicado_por
       FROM cartel c
       JOIN "user" u ON u.id_user = c.id_user
       WHERE c.activo = true
         AND c.lat BETWEEN $1 AND $2
         AND c.lng BETWEEN $3 AND $4
       LIMIT 50`,
      params
    ),
  ]);

  return {
    servicios: serviciosRes.rows,
    carteles: cartelesRes.rows,
    amigos: [],
  };
}

// ─── Carteles ────────────────────────────────────────────────────────────────

export async function crearCartel(userId, { tipo, descripcion, telefono_contacto, lat, lng }) {
  const result = await pool.query(
    `INSERT INTO cartel (id_user, tipo, descripcion, telefono_contacto, lat, lng, activo, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
     RETURNING
       id_cartel AS id, tipo, descripcion, telefono_contacto, lat, lng, created_at`,
    [userId, tipo, descripcion || null, telefono_contacto, parseFloat(lat), parseFloat(lng)]
  );
  return result.rows[0];
}

export async function eliminarCartel(userId, cartelId) {
  const check = await pool.query(
    'SELECT id_user FROM cartel WHERE id_cartel = $1 AND activo = true',
    [cartelId]
  );

  if (!check.rows.length) return { notFound: true };
  if (check.rows[0].id_user !== userId) return { forbidden: true };

  await pool.query(
    'UPDATE cartel SET activo = false WHERE id_cartel = $1',
    [cartelId]
  );

  return { ok: true };
}

// ─── Amigos ──────────────────────────────────────────────────────────────────

export async function getAmigos(userId) {
  const result = await pool.query(
    `SELECT
       u.id_user AS usuario_id,
       u.nombre || ' ' || u.apellido AS nombre,
       u.foto_perfil AS foto_perfil_url
     FROM amistad a
     JOIN "user" u ON u.id_user = CASE WHEN a.id_user_a = $1 THEN a.id_user_b ELSE a.id_user_a END
     WHERE (a.id_user_a = $1 OR a.id_user_b = $1)
       AND a.estado = 'aceptada'`,
    [userId]
  );
  return result.rows;
}

export async function getSolicitudes(userId) {
  const result = await pool.query(
    `SELECT
       a.id_amistad AS id,
       u.id_user AS usuario_id,
       u.nombre || ' ' || u.apellido AS nombre,
       u.foto_perfil AS foto_perfil_url,
       a.created_at
     FROM amistad a
     JOIN "user" u ON u.id_user = a.id_user_a
     WHERE a.id_user_b = $1 AND a.estado = 'pendiente'`,
    [userId]
  );
  return result.rows;
}

export async function enviarSolicitud(userId, destinoId) {
  const check = await pool.query(
    `SELECT 1 FROM amistad
     WHERE (id_user_a = $1 AND id_user_b = $2)
        OR (id_user_a = $2 AND id_user_b = $1)`,
    [userId, destinoId]
  );

  if (check.rows.length) return { conflict: true };

  await pool.query(
    `INSERT INTO amistad (id_user_a, id_user_b, estado, created_at, updated_at)
     VALUES ($1, $2, 'pendiente', NOW(), NOW())`,
    [userId, destinoId]
  );

  return { ok: true };
}

export async function responderSolicitud(userId, solicitudId, accion) {
  const estado = accion === 'aceptar' ? 'aceptada' : 'rechazada';

  const result = await pool.query(
    `UPDATE amistad SET estado = $1, updated_at = NOW()
     WHERE id_amistad = $2 AND id_user_b = $3`,
    [estado, solicitudId, userId]
  );

  return result.rowCount > 0;
}

// ─── Ubicación ───────────────────────────────────────────────────────────────

export async function actualizarUbicacion(userId, lat, lng) {
  await pool.query(
    `INSERT INTO ubicacion_usuario (id_user, lat, lng, updated_at, compartir_ubicacion)
     VALUES ($1, $2, $3, NOW(), true)
     ON CONFLICT (id_user)
     DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = NOW()`,
    [userId, lat, lng]
  );
}

// ─── Buscar usuarios ─────────────────────────────────────────────────────────

export async function buscarUsuarios(userId, q) {
  const result = await pool.query(
    `SELECT DISTINCT
       u.id_user AS usuario_id,
       u.nombre || ' ' || u.apellido AS nombre,
       u.foto_perfil AS foto_perfil_url,
       CASE WHEN a.id_amistad IS NOT NULL THEN true ELSE false END AS es_amigo
     FROM "user" u
     LEFT JOIN amistad a ON (
       (a.id_user_a = $1 AND a.id_user_b = u.id_user)
       OR (a.id_user_a = u.id_user AND a.id_user_b = $1)
     ) AND a.estado = 'aceptada'
     WHERE u.id_user <> $1
       AND (u.nombre ILIKE $2 OR u.apellido ILIKE $2)
     ORDER BY nombre`,
    [userId, `%${q}%`]
  );
  return result.rows;
}
