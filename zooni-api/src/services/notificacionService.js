import { getPool, sql } from '../config/database.js';

export async function getNotificacionesAsync(userId, page, limit, soloNoLeidas) {
  const offset = (page - 1) * limit;
  const whereLeida = soloNoLeidas ? 'AND n.Leido = 0' : '';

  const query = `
    SELECT
      n.Id,
      n.Tipo,
      n.Titulo,
      n.Mensaje   AS Cuerpo,
      n.Leido,
      n.Fecha,
      NULL        AS FotoUrl,
      NULL        AS Redirigea
    FROM Notificacion n
    WHERE n.Id_User = @UserId ${whereLeida}
    ORDER BY n.Fecha DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

    SELECT COUNT(*) AS Total FROM Notificacion WHERE Id_User = @UserId AND Leido = 0;
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .input('Offset', sql.Int, offset)
    .input('Limit', sql.Int, limit)
    .query(query);

  const notificaciones = result.recordsets[0].map(row => ({
    id: row.Id,
    tipo: row.Tipo || '',
    titulo: row.Titulo || '',
    cuerpo: row.Cuerpo || '',
    leida: row.Leido,
    createdAt: row.Fecha,
    fotoUrl: row.FotoUrl,
    redirigea: row.Redirigea,
  }));

  const totalNoLeidas = result.recordsets[1][0].Total;

  return {
    notificaciones,
    totalNoLeidas,
  };
}

export async function marcarLeidaAsync(userId, notifId) {
  const query = `
    UPDATE Notificacion SET Leido = 1
    WHERE Id = @Id AND Id_User = @UserId
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('Id', sql.Int, notifId)
    .input('UserId', sql.Int, userId)
    .query(query);

  return result.rowsAffected[0] > 0;
}

export async function marcarTodasLeidasAsync(userId) {
  const query = `
    UPDATE Notificacion SET Leido = 1
    WHERE Id_User = @UserId AND Leido = 0
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(query);

  return result.rowsAffected[0];
}
