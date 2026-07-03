/**
 * publicacionesService.js — Lógica de negocio para publicaciones
 *
 * Tabla: Publicaciones(Id_Publicacion, Id_User, ImagenUrl, Descripcion, CreadoEn)
 */

import { getPool, sql } from '../config/database.js';

// ── Helper: normalizar fila al DTO del frontend ───────────────────────────────
function rowToPublicacion(row) {
  return {
    id:          row.Id_Publicacion,
    imagen_url:  row.ImagenUrl,
    descripcion: row.Descripcion ?? null,
    creado_en:   row.CreadoEn instanceof Date
                   ? row.CreadoEn.toISOString()
                   : String(row.CreadoEn),
  };
}

// ── 1. GET publicaciones del usuario ─────────────────────────────────────────

/**
 * Retorna todas las publicaciones del usuario, ordenadas por fecha desc.
 *
 * @param {number} userId
 * @returns {{ publicaciones: object[] }}
 */
export async function getPublicacionesAsync(userId) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT
        Id_Publicacion,
        Id_User,
        ImagenUrl,
        Descripcion,
        CreadoEn
      FROM Publicaciones
      WHERE Id_User = @UserId
      ORDER BY CreadoEn DESC
    `);

  return { publicaciones: result.recordset.map(rowToPublicacion) };
}

// ── 2. POST crear publicación ─────────────────────────────────────────────────

/**
 * Inserta una nueva publicación.
 *
 * @param {number} userId
 * @param {string} imagenUrl
 * @param {string|null} descripcion
 * @returns {{ publicacion: object }}
 */
export async function crearPublicacionAsync(userId, imagenUrl, descripcion) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('UserId',      sql.Int,                  userId)
    .input('ImagenUrl',   sql.NVarChar(500),         imagenUrl)
    .input('Descripcion', sql.NVarChar(sql.MAX),     descripcion ?? null)
    .query(`
      INSERT INTO Publicaciones (Id_User, ImagenUrl, Descripcion)
      OUTPUT
        INSERTED.Id_Publicacion,
        INSERTED.Id_User,
        INSERTED.ImagenUrl,
        INSERTED.Descripcion,
        INSERTED.CreadoEn
      VALUES (@UserId, @ImagenUrl, @Descripcion)
    `);

  return { publicacion: rowToPublicacion(result.recordset[0]) };
}
