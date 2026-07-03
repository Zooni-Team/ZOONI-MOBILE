/**
 * perfilService.js — Lógica de negocio para el perfil del usuario
 *
 * Todos los métodos son async y reciben userId (int).
 * Usa MSSQL via getPool/sql (mismo patrón que homeService).
 *
 * Tabla principal: [User]
 *   Id_User, Nombre, Apellido, NombreUsuario, Mail,
 *   Bio, Ubicacion, FotoPerfil
 *
 * Tablas auxiliares (de la migration 007):
 *   Publicaciones(Id_Publicacion, Id_User, ImagenUrl, Descripcion, CreadoEn)
 *   Seguidores(Id_Seguidor, Seguidor_Id, Seguido_Id, CreadoEn)
 */

import { getPool, sql } from '../config/database.js';

// ── Helper: normalizar fila de [User] al DTO esperado por el frontend ─────────
function rowToPerfil(row, stats = {}) {
  return {
    id:                   row.Id_User,
    nombre:               row.Nombre        ?? null,
    apellido:             row.Apellido       ?? null,
    nombre_usuario:       row.NombreUsuario  ?? null,
    email:                row.Mail           ?? null,
    bio:                  row.Bio            ?? null,
    ubicacion:            row.Ubicacion      ?? null,
    foto_perfil_url:      row.FotoPerfil     ?? null,
    total_publicaciones:  parseInt(stats.total_publicaciones ?? row.TotalPublicaciones ?? 0),
    total_seguidores:     parseInt(stats.total_seguidores    ?? row.TotalSeguidores    ?? 0),
    total_siguiendo:      parseInt(stats.total_siguiendo     ?? row.TotalSiguiendo     ?? 0),
  };
}

// ── 1. GET perfil completo con estadísticas ───────────────────────────────────

/**
 * Devuelve el perfil del usuario autenticado con totales de
 * publicaciones, seguidores y siguiendo.
 *
 * @param {number} userId
 * @returns {{ perfil: object } | null}
 */
export async function getPerfilAsync(userId) {
  const query = `
    SELECT
      u.Id_User,
      u.Nombre,
      u.Apellido,
      u.NombreUsuario,
      u.Mail,
      u.Bio,
      u.Ubicacion,
      u.FotoPerfil,
      (SELECT COUNT(*) FROM Publicaciones  WHERE Id_User    = u.Id_User) AS TotalPublicaciones,
      (SELECT COUNT(*) FROM Seguidores     WHERE Seguido_Id = u.Id_User) AS TotalSeguidores,
      (SELECT COUNT(*) FROM Seguidores     WHERE Seguidor_Id= u.Id_User) AS TotalSiguiendo
    FROM [User] u
    WHERE u.Id_User = @UserId
  `;

  const pool   = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(query);

  if (result.recordset.length === 0) return null;

  return { perfil: rowToPerfil(result.recordset[0]) };
}

// ── 2. PUT perfil (campos de texto) ──────────────────────────────────────────

/**
 * Actualiza nombre, apellido, nombre_usuario, bio y ubicación.
 * Valida unicidad de NombreUsuario.
 *
 * @param {number} userId
 * @param {{ nombre, apellido, nombre_usuario, bio, ubicacion }} campos
 * @returns {{ perfil: object } | { conflict: true } | { badRequest: string }}
 */
export async function updatePerfilAsync(userId, campos) {
  const { nombre, apellido, nombre_usuario, bio, ubicacion } = campos;

  // Validar nombre_usuario
  if (nombre_usuario !== undefined && nombre_usuario !== null) {
    const nu = String(nombre_usuario).trim();
    if (/\s/.test(nu)) {
      return { badRequest: 'El nombre de usuario no puede contener espacios' };
    }
    if (!/^[a-z0-9_.]+$/.test(nu)) {
      return { badRequest: 'El nombre de usuario solo puede contener letras minúsculas, números, _ y .' };
    }

    // Verificar unicidad
    const pool    = await getPool();
    const dupRes  = await pool.request()
      .input('NombreUsuario', sql.NVarChar(50), nu)
      .input('UserId',        sql.Int, userId)
      .query(`
        SELECT Id_User FROM [User]
        WHERE NombreUsuario = @NombreUsuario
          AND Id_User != @UserId
      `);

    if (dupRes.recordset.length > 0) {
      return { conflict: true };
    }
  }

  // UPDATE
  const pool   = await getPool();
  const result = await pool.request()
    .input('Nombre',        sql.NVarChar(100),  nombre        ?? null)
    .input('Apellido',      sql.NVarChar(100),  apellido      ?? null)
    .input('NombreUsuario', sql.NVarChar(50),   nombre_usuario ?? null)
    .input('Bio',           sql.NVarChar(sql.MAX), bio        ?? null)
    .input('Ubicacion',     sql.NVarChar(100),  ubicacion     ?? null)
    .input('UserId',        sql.Int,            userId)
    .query(`
      UPDATE [User]
      SET
        Nombre        = COALESCE(@Nombre,        Nombre),
        Apellido      = COALESCE(@Apellido,      Apellido),
        NombreUsuario = COALESCE(@NombreUsuario, NombreUsuario),
        Bio           = @Bio,
        Ubicacion     = @Ubicacion
      OUTPUT
        INSERTED.Id_User,
        INSERTED.Nombre,
        INSERTED.Apellido,
        INSERTED.NombreUsuario,
        INSERTED.Mail,
        INSERTED.Bio,
        INSERTED.Ubicacion,
        INSERTED.FotoPerfil
      WHERE Id_User = @UserId
    `);

  if (result.recordset.length === 0) return null;

  // Volver a traer las estadísticas
  const statsRes = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT
        (SELECT COUNT(*) FROM Publicaciones  WHERE Id_User    = @UserId) AS TotalPublicaciones,
        (SELECT COUNT(*) FROM Seguidores     WHERE Seguido_Id = @UserId) AS TotalSeguidores,
        (SELECT COUNT(*) FROM Seguidores     WHERE Seguidor_Id= @UserId) AS TotalSiguiendo
    `);

  const stats = statsRes.recordset[0] ?? {};
  return {
    perfil: rowToPerfil(result.recordset[0], {
      total_publicaciones: stats.TotalPublicaciones,
      total_seguidores:    stats.TotalSeguidores,
      total_siguiendo:     stats.TotalSiguiendo,
    }),
  };
}

// ── 3. PUT foto de perfil ─────────────────────────────────────────────────────

/**
 * Actualiza la URL de la foto de perfil.
 *
 * @param {number} userId
 * @param {string} fotoUrl
 * @returns {{ foto_perfil_url: string }}
 */
export async function updateFotoPerfilAsync(userId, fotoUrl) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('FotoPerfil', sql.NVarChar(500), fotoUrl)
    .input('UserId',     sql.Int,           userId)
    .query(`
      UPDATE [User]
      SET FotoPerfil = @FotoPerfil
      OUTPUT INSERTED.FotoPerfil
      WHERE Id_User = @UserId
    `);

  if (result.recordset.length === 0) return null;
  return { foto_perfil_url: result.recordset[0].FotoPerfil };
}
