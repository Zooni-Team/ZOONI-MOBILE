const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const auth = require('../middleware/auth');

// PUT /api/v1/ubicacion
router.put('/', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined)
      return res.status(400).json({ error: 'lat y lng son requeridos' });

    const pool = await getPool();

    // UPSERT — SQL Server: MERGE o IF EXISTS
    await pool.request()
      .input('userId', sql.Int,   req.userId)
      .input('lat',    sql.Float, parseFloat(lat))
      .input('lng',    sql.Float, parseFloat(lng))
      .query(`
        IF EXISTS (SELECT 1 FROM UbicacionUsuario WHERE Id_User = @userId)
          UPDATE UbicacionUsuario
            SET Lat = @lat, Lng = @lng, UpdatedAt = SYSUTCDATETIME()
          WHERE Id_User = @userId
        ELSE
          INSERT INTO UbicacionUsuario (Id_User, Lat, Lng, CompartirUbicacion)
          VALUES (@userId, @lat, @lng, 1)
      `);

    res.json({ mensaje: 'Ubicación actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
});

module.exports = router;
