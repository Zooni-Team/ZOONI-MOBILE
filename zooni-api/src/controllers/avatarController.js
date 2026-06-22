import { getPool, sql } from '../config/database.js';
import { getUserId } from '../middleware/auth.js';

export async function getAvatares(req, res) {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const pool = await getPool();

    const mascotaResult = await pool.request()
      .input('PetId', sql.Int, petId)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT Id_Mascota AS id, Nombre AS nombre, Especie AS especie, ImagenAsset AS imagen_asset
        FROM Mascota
        WHERE Id_Mascota = @PetId AND Id_User = @UserId
      `);

    if (mascotaResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    const mascota = mascotaResult.recordset[0];

    if (mascota.id === undefined || mascota.id === null) {
      return res.status(403).json({ error: 'No tenés permiso para ver esta mascota' });
    }

    const avataresResult = await pool.request()
      .input('Especie', sql.NVarChar, mascota.especie)
      .query(`
        SELECT id, asset_name, nombre, orden
        FROM avatares_catalogo
        WHERE especie = @Especie AND activo = 1
        ORDER BY orden ASC
      `);

    res.json({
      mascota: {
        id: mascota.id,
        nombre: mascota.nombre,
        especie: mascota.especie,
        imagen_asset: mascota.imagen_asset ?? 'perro_default',
      },
      avatares: avataresResult.recordset,
    });
  } catch (err) {
    console.error('Error en getAvatares:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function putAvatar(req, res) {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const { imagen_asset } = req.body;

    if (!imagen_asset) {
      return res.status(400).json({ error: 'El campo imagen_asset es requerido' });
    }

    const pool = await getPool();

    // Verificar que la mascota pertenece al usuario
    const mascotaResult = await pool.request()
      .input('PetId', sql.Int, petId)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT Id_Mascota, Especie FROM Mascota
        WHERE Id_Mascota = @PetId AND Id_User = @UserId
      `);

    if (mascotaResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    const { Especie: especie } = mascotaResult.recordset[0];

    // Verificar que el avatar existe en el catálogo para la especie correcta
    const catalogResult = await pool.request()
      .input('AssetName', sql.NVarChar, imagen_asset)
      .input('Especie', sql.NVarChar, especie)
      .query(`
        SELECT id FROM avatares_catalogo
        WHERE asset_name = @AssetName AND especie = @Especie AND activo = 1
      `);

    if (catalogResult.recordset.length === 0) {
      return res.status(400).json({ error: 'Avatar no válido para esta especie' });
    }

    // Actualizar el avatar
    const updateResult = await pool.request()
      .input('ImagenAsset', sql.NVarChar, imagen_asset)
      .input('PetId', sql.Int, petId)
      .input('UserId', sql.Int, userId)
      .query(`
        UPDATE Mascota
        SET ImagenAsset = @ImagenAsset
        OUTPUT INSERTED.Id_Mascota AS id, INSERTED.Nombre AS nombre, INSERTED.ImagenAsset AS imagen_asset
        WHERE Id_Mascota = @PetId AND Id_User = @UserId
      `);

    const updated = updateResult.recordset[0];

    res.json({
      mensaje: 'Avatar actualizado correctamente',
      mascota: {
        id: updated.id,
        nombre: updated.nombre,
        imagen_asset: updated.imagen_asset,
      },
    });
  } catch (err) {
    console.error('Error en putAvatar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
