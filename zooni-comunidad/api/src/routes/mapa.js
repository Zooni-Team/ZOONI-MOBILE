const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const auth = require('../middleware/auth');

// GET /api/v1/comunidad/mapa?lat_min=&lat_max=&lng_min=&lng_max=&tipos=
router.get('/mapa', auth, async (req, res) => {
  try {
    const { lat_min, lat_max, lng_min, lng_max } = req.query;
    const userId = req.userId;
    const pool = await getPool();

    // ─── Servicios dentro del bounding box ───────────────────────────────
    const serviciosResult = await pool.request()
      .input('lat_min', sql.Float, parseFloat(lat_min) || -90)
      .input('lat_max', sql.Float, parseFloat(lat_max) || 90)
      .input('lng_min', sql.Float, parseFloat(lng_min) || -180)
      .input('lng_max', sql.Float, parseFloat(lng_max) || 180)
      .query(`
        SELECT TOP 50
          Id_Servicio AS id, Tipo AS tipo, Nombre AS nombre,
          Direccion AS direccion, Telefono AS telefono,
          Descripcion AS descripcion, Lat AS lat, Lng AS lng,
          GoogleMapsUrl AS google_maps_url
        FROM Servicio
        WHERE Lat BETWEEN @lat_min AND @lat_max
          AND Lng BETWEEN @lng_min AND @lng_max
      `);

    // ─── Carteles activos dentro del bounding box ─────────────────────────
    const cartelesResult = await pool.request()
      .input('lat_min', sql.Float, parseFloat(lat_min) || -90)
      .input('lat_max', sql.Float, parseFloat(lat_max) || 90)
      .input('lng_min', sql.Float, parseFloat(lng_min) || -180)
      .input('lng_max', sql.Float, parseFloat(lng_max) || 180)
      .query(`
        SELECT TOP 50
          c.Id_Cartel AS id, c.Id_User AS usuario_id,
          c.Tipo AS tipo, c.Descripcion AS descripcion,
          c.TelefonoContacto AS telefono_contacto,
          c.FotoUrl AS foto_url, c.Lat AS lat, c.Lng AS lng,
          c.CreatedAt AS created_at,
          m.Nombre AS mascota_nombre, m.Especie AS mascota_especie, m.Raza AS mascota_raza,
          u.Nombre + ' ' + ISNULL(u.Apellido, '') AS publicado_por
        FROM Cartel c
        LEFT JOIN Mascota m ON m.Id_Mascota = c.Id_Mascota
        INNER JOIN [User] u ON u.Id_User = c.Id_User
        WHERE c.Activo = 1
          AND c.Lat BETWEEN @lat_min AND @lat_max
          AND c.Lng BETWEEN @lng_min AND @lng_max
      `);

    // ─── Amigos con ubicación compartida ─────────────────────────────────
    const amigosResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT
          u.Id_User AS usuario_id,
          u.Nombre AS nombre,
          u.FotoPerfil AS foto_perfil_url,
          ub.Lat AS lat,
          ub.Lng AS lng,
          m.Nombre AS mascota_nombre
        FROM Amistad a
        INNER JOIN [User] u ON u.Id_User = CASE
          WHEN a.Id_User_A = @userId THEN a.Id_User_B
          ELSE a.Id_User_A
        END
        INNER JOIN UbicacionUsuario ub ON ub.Id_User = u.Id_User
          AND ub.CompartirUbicacion = 1
        LEFT JOIN Mascota m ON m.Id_Mascota = (
          SELECT TOP 1 Id_Mascota FROM Mascota WHERE Id_User = u.Id_User ORDER BY Id_Mascota ASC
        )
        WHERE (a.Id_User_A = @userId OR a.Id_User_B = @userId)
          AND a.Estado = 'aceptada'
      `);

    res.json({
      servicios: serviciosResult.recordset,
      carteles: cartelesResult.recordset,
      amigos: amigosResult.recordset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos del mapa' });
  }
});

// GET /api/v1/comunidad/servicios?lat_min=&lat_max=&lng_min=&lng_max=&tipo=
router.get('/servicios', auth, async (req, res) => {
  try {
    const { lat_min, lat_max, lng_min, lng_max, tipo } = req.query;
    const pool = await getPool();

    const request = pool.request()
      .input('lat_min', sql.Float, parseFloat(lat_min) || -90)
      .input('lat_max', sql.Float, parseFloat(lat_max) || 90)
      .input('lng_min', sql.Float, parseFloat(lng_min) || -180)
      .input('lng_max', sql.Float, parseFloat(lng_max) || 180);

    let whereClause = 'WHERE Lat BETWEEN @lat_min AND @lat_max AND Lng BETWEEN @lng_min AND @lng_max';
    if (tipo && tipo !== 'todos') {
      request.input('tipo', sql.NVarChar, tipo);
      whereClause += ' AND Tipo = @tipo';
    }

    const result = await request.query(`
      SELECT TOP 50
        Id_Servicio AS id, Tipo AS tipo, Nombre AS nombre,
        Direccion AS direccion, Telefono AS telefono,
        Descripcion AS descripcion, Lat AS lat, Lng AS lng,
        GoogleMapsUrl AS google_maps_url
      FROM Servicio
      ${whereClause}
    `);

    res.json({ servicios: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

module.exports = router;
