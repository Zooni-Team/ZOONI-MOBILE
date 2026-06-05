const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool, sql } = require('../db');
const auth = require('../middleware/auth');

// ─── Multer config ────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cartel_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten JPG, PNG o GIF'));
    }
  },
});

// POST /api/v1/carteles
router.post('/', auth, upload.single('foto'), async (req, res) => {
  try {
    const { tipo, mascota_id, descripcion, telefono_contacto, lat, lng } = req.body;

    if (!tipo) return res.status(400).json({ error: 'El tipo es requerido' });
    if (!telefono_contacto) return res.status(400).json({ error: 'El teléfono de contacto es requerido' });
    if (!lat || !lng) return res.status(400).json({ error: 'La ubicación es requerida' });

    const fotoUrl = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    const pool = await getPool();
    const result = await pool.request()
      .input('userId',    sql.Int,       req.userId)
      .input('mascotaId', sql.Int,       mascota_id ? parseInt(mascota_id) : null)
      .input('tipo',      sql.NVarChar,  tipo)
      .input('desc',      sql.NVarChar,  descripcion || null)
      .input('telefono',  sql.NVarChar,  telefono_contacto)
      .input('fotoUrl',   sql.NVarChar,  fotoUrl)
      .input('lat',       sql.Float,     parseFloat(lat))
      .input('lng',       sql.Float,     parseFloat(lng))
      .query(`
        INSERT INTO Cartel (Id_User, Id_Mascota, Tipo, Descripcion, TelefonoContacto, FotoUrl, Lat, Lng, Activo)
        OUTPUT INSERTED.Id_Cartel AS id, INSERTED.Lat AS lat, INSERTED.Lng AS lng,
               INSERTED.Tipo AS tipo, INSERTED.CreatedAt AS created_at
        VALUES (@userId, @mascotaId, @tipo, @desc, @telefono, @fotoUrl, @lat, @lng, 1)
      `);

    res.status(201).json({
      mensaje: 'Cartel creado exitosamente',
      cartel: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el cartel' });
  }
});

// DELETE /api/v1/carteles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const cartelId = parseInt(req.params.id);
    const pool = await getPool();

    // Verificar propiedad
    const check = await pool.request()
      .input('id',     sql.Int, cartelId)
      .input('userId', sql.Int, req.userId)
      .query('SELECT Id_Cartel, FotoUrl FROM Cartel WHERE Id_Cartel = @id AND Activo = 1');

    if (check.recordset.length === 0)
      return res.status(404).json({ error: 'Cartel no encontrado' });

    if (check.recordset[0].Id_Cartel && check.recordset[0].usuario_id !== req.userId) {
      // Verifica ownership
      const own = await pool.request()
        .input('id',     sql.Int, cartelId)
        .input('userId', sql.Int, req.userId)
        .query('SELECT 1 FROM Cartel WHERE Id_Cartel = @id AND Id_User = @userId AND Activo = 1');
      if (own.recordset.length === 0)
        return res.status(403).json({ error: 'No tenés permiso para eliminar este cartel' });
    }

    // Soft delete
    await pool.request()
      .input('id',     sql.Int, cartelId)
      .input('userId', sql.Int, req.userId)
      .query('UPDATE Cartel SET Activo = 0 WHERE Id_Cartel = @id AND Id_User = @userId');

    res.json({ mensaje: 'Cartel eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el cartel' });
  }
});

module.exports = router;
