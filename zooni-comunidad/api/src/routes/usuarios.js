const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const auth = require('../middleware/auth');

// GET /api/v1/usuarios/buscar?q=
router.get('/buscar', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.json({ resultados: [] });

    const busqueda = `%${q.trim()}%`;
    const pool = await getPool();

    const result = await pool.request()
      .input('q',      sql.NVarChar, busqueda)
      .input('userId', sql.Int,      req.userId)
      .query(`
        SELECT TOP 20
          u.Id_User    AS usuario_id,
          u.Nombre     AS nombre,
          u.FotoPerfil AS foto_perfil_url,
          u.Ubicacion  AS barrio,
          m.Nombre     AS mascota_nombre,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM Amistad
              WHERE ((Id_User_A = @userId AND Id_User_B = u.Id_User)
                  OR (Id_User_A = u.Id_User AND Id_User_B = @userId))
              AND Estado = 'aceptada'
            ) THEN 1 ELSE 0
          END AS es_amigo
        FROM [User] u
        LEFT JOIN Mascota m ON m.Id_Mascota = (
          SELECT TOP 1 Id_Mascota FROM Mascota WHERE Id_User = u.Id_User ORDER BY Id_Mascota ASC
        )
        WHERE u.Id_User <> @userId
          AND u.Estado = 1
          AND (u.Nombre LIKE @q OR u.Apellido LIKE @q OR m.Nombre LIKE @q)
        ORDER BY u.Nombre ASC
      `);

    res.json({ resultados: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

module.exports = router;
