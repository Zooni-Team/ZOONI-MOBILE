import pool from '../config/pgPool.js';

export async function getNotificacionesAsync(userId, page, limit, soloNoLeidas) {
  const offset = (page - 1) * limit;
  const whereLeida = soloNoLeidas ? 'AND n.leido = false' : '';

  const query = `
    SELECT
      n.id,
      n.tipo,
      n.titulo,
      n.mensaje   AS cuerpo,
      n.leido,
      n.fecha,
      NULL::text  AS foto_url,
      NULL::text  AS redirige_a
    FROM notificacion n
    WHERE n.id_user = $1 ${whereLeida}
    ORDER BY n.fecha DESC
    LIMIT $2 OFFSET $3
  `;

  const countQuery = `
    SELECT COUNT(*) AS total FROM notificacion WHERE id_user = $1 AND leido = false
  `;

  const [result, countResult] = await Promise.all([
    pool.query(query, [userId, limit, offset]),
    pool.query(countQuery, [userId]),
  ]);

  const notificaciones = result.rows.map(row => ({
    id: row.id,
    tipo: row.tipo || '',
    titulo: row.titulo || '',
    cuerpo: row.cuerpo || '',
    leida: row.leido,
    createdAt: row.fecha,
    fotoUrl: row.foto_url,
    redirigea: row.redirige_a,
  }));

  const totalNoLeidas = parseInt(countResult.rows[0].total) || 0;

  return {
    notificaciones,
    totalNoLeidas,
  };
}

export async function marcarLeidaAsync(userId, notifId) {
  const result = await pool.query(
    `UPDATE notificacion SET leido = true
     WHERE id = $1 AND id_user = $2`,
    [notifId, userId]
  );
  return result.rowCount > 0;
}

export async function marcarTodasLeidasAsync(userId) {
  const result = await pool.query(
    `UPDATE notificacion SET leido = true
     WHERE id_user = $1 AND leido = false`,
    [userId]
  );
  return result.rowCount;
}
