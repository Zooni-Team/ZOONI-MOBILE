const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const auth = require('../middleware/auth');

// GET /api/v1/amigos
router.get('/', auth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.userId)
      .query(`
        SELECT
          u.Id_User AS usuario_id,
          u.Nombre  AS nombre,
          u.FotoPerfil AS foto_perfil_url,
          m.Nombre  AS mascota_nombre,
          ub.Lat    AS lat,
          ub.Lng    AS lng,
          CASE
            WHEN ub.UpdatedAt >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1
            ELSE 0
          END AS online,
          CASE
            WHEN ub.Lat IS NOT NULL THEN
              ROUND(
                6371 * 2 * ASIN(SQRT(
                  POWER(SIN(RADIANS((ub.Lat - myub.Lat) / 2)), 2)
                  + COS(RADIANS(myub.Lat)) * COS(RADIANS(ub.Lat))
                  * POWER(SIN(RADIANS((ub.Lng - myub.Lng) / 2)), 2)
                )), 1
              )
            ELSE NULL
          END AS distancia_km
        FROM Amistad a
        INNER JOIN [User] u ON u.Id_User = CASE
          WHEN a.Id_User_A = @userId THEN a.Id_User_B
          ELSE a.Id_User_A
        END
        LEFT JOIN UbicacionUsuario ub ON ub.Id_User = u.Id_User
        LEFT JOIN UbicacionUsuario myub ON myub.Id_User = @userId
        LEFT JOIN Mascota m ON m.Id_Mascota = (
          SELECT TOP 1 Id_Mascota FROM Mascota WHERE Id_User = u.Id_User ORDER BY Id_Mascota ASC
        )
        WHERE (a.Id_User_A = @userId OR a.Id_User_B = @userId)
          AND a.Estado = 'aceptada'
      `);

    res.json({ amigos: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener amigos' });
  }
});

// POST /api/v1/amigos/solicitud
router.post('/solicitud', auth, async (req, res) => {
  try {
    const { usuario_destino_id } = req.body;
    if (!usuario_destino_id) return res.status(400).json({ error: 'usuario_destino_id es requerido' });

    const destId = parseInt(usuario_destino_id);
    if (destId === req.userId) return res.status(400).json({ error: 'No podés enviarte una solicitud a vos mismo' });

    const pool = await getPool();

    // Verificar duplicado (en ambos sentidos)
    const exists = await pool.request()
      .input('a', sql.Int, req.userId)
      .input('b', sql.Int, destId)
      .query(`
        SELECT 1 FROM Amistad
        WHERE (Id_User_A = @a AND Id_User_B = @b)
           OR (Id_User_A = @b AND Id_User_B = @a)
      `);

    if (exists.recordset.length > 0)
      return res.status(409).json({ error: 'Ya existe una solicitud o ya son amigos' });

    await pool.request()
      .input('a',      sql.Int,     req.userId)
      .input('b',      sql.Int,     destId)
      .input('estado', sql.NVarChar,'pendiente')
      .query(`
        INSERT INTO Amistad (Id_User_A, Id_User_B, Estado) VALUES (@a, @b, @estado)
      `);

    res.status(201).json({ mensaje: 'Solicitud enviada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// PATCH /api/v1/amigos/solicitud/:id
router.patch('/solicitud/:id', auth, async (req, res) => {
  try {
    const solicitudId = parseInt(req.params.id);
    const { accion } = req.body; // 'aceptar' | 'rechazar'

    if (!['aceptar', 'rechazar'].includes(accion))
      return res.status(400).json({ error: 'accion debe ser "aceptar" o "rechazar"' });

    const nuevoEstado = accion === 'aceptar' ? 'aceptada' : 'rechazada';
    const pool = await getPool();

    // Solo el destinatario puede responder
    const check = await pool.request()
      .input('id',     sql.Int, solicitudId)
      .input('userId', sql.Int, req.userId)
      .query(`SELECT Id_Amistad FROM Amistad WHERE Id_Amistad = @id AND Id_User_B = @userId AND Estado = 'pendiente'`);

    if (check.recordset.length === 0)
      return res.status(404).json({ error: 'Solicitud no encontrada' });

    await pool.request()
      .input('estado', sql.NVarChar, nuevoEstado)
      .input('id',     sql.Int,      solicitudId)
      .query(`UPDATE Amistad SET Estado = @estado, UpdatedAt = SYSUTCDATETIME() WHERE Id_Amistad = @id`);

    const msg = accion === 'aceptar'
      ? '¡Ahora son amigos!'
      : 'Solicitud rechazada';

    res.json({ mensaje: msg, amistad_id: solicitudId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al responder solicitud' });
  }
});

// GET /api/v1/amigos/solicitudes  — solicitudes pendientes recibidas
router.get('/solicitudes', auth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.userId)
      .query(`
        SELECT
          a.Id_Amistad AS id,
          u.Id_User    AS usuario_id,
          u.Nombre     AS nombre,
          u.FotoPerfil AS foto_perfil_url
        FROM Amistad a
        INNER JOIN [User] u ON u.Id_User = a.Id_User_A
        WHERE a.Id_User_B = @userId AND a.Estado = 'pendiente'
        ORDER BY a.CreatedAt DESC
      `);

    res.json({ solicitudes: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

module.exports = router;
