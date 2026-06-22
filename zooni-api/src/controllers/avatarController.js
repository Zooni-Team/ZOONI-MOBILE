import pg from 'pg';
import dotenv from 'dotenv';
import { getUserId } from '../middleware/auth.js';

dotenv.config();

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'zooni',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function getAvatares(req, res) {
  try {
    const userId = getUserId(req);
    const petId  = parseInt(req.params.petId);

    const mascotaResult = await pool.query(
      `SELECT id, nombre, especie, imagen_asset
       FROM mascotas
       WHERE id = $1 AND usuario_id = $2`,
      [petId, userId]
    );

    if (mascotaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    const mascota = mascotaResult.rows[0];

    const avataresResult = await pool.query(
      `SELECT id, asset_name, nombre, orden
       FROM avatares_catalogo
       WHERE especie = $1 AND activo = TRUE
       ORDER BY orden ASC`,
      [mascota.especie]
    );

    res.json({
      mascota: {
        id:           mascota.id,
        nombre:       mascota.nombre,
        especie:      mascota.especie,
        imagen_asset: mascota.imagen_asset ?? 'perro_default',
      },
      avatares: avataresResult.rows,
    });
  } catch (err) {
    console.error('Error en getAvatares:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function putAvatar(req, res) {
  try {
    const userId      = getUserId(req);
    const petId       = parseInt(req.params.petId);
    const { imagen_asset } = req.body;

    if (!imagen_asset) {
      return res.status(400).json({ error: 'El campo imagen_asset es requerido' });
    }

    const mascotaResult = await pool.query(
      `SELECT id, especie FROM mascotas WHERE id = $1 AND usuario_id = $2`,
      [petId, userId]
    );

    if (mascotaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    const { especie } = mascotaResult.rows[0];

    const catalogResult = await pool.query(
      `SELECT id FROM avatares_catalogo
       WHERE asset_name = $1 AND especie = $2 AND activo = TRUE`,
      [imagen_asset, especie]
    );

    if (catalogResult.rows.length === 0) {
      return res.status(400).json({ error: 'Avatar no válido para esta especie' });
    }

    const updateResult = await pool.query(
      `UPDATE mascotas
       SET imagen_asset = $1
       WHERE id = $2 AND usuario_id = $3
       RETURNING id, nombre, imagen_asset`,
      [imagen_asset, petId, userId]
    );

    const updated = updateResult.rows[0];

    res.json({
      mensaje: 'Avatar actualizado correctamente',
      mascota: {
        id:           updated.id,
        nombre:       updated.nombre,
        imagen_asset: updated.imagen_asset,
      },
    });
  } catch (err) {
    console.error('Error en putAvatar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
