/**
 * consejosService.js — Lógica de negocio para Consejos y Curiosidades
 *
 * Gestiona la consulta de consejos desde la base de datos SQL Server.
 * Los consejos son contenido administrado por el equipo de Zooni (solo lectura para usuarios).
 *
 * Lógica de prioridad de consejos:
 *   1. Consejos específicos de la raza de la mascota (raza IS NOT NULL AND raza = mascota.raza)
 *   2. Consejos genéricos de la especie (raza IS NULL)
 *   Los específicos se muestran primero (orden ASC), luego los genéricos (orden ASC).
 *
 * Normalización:
 *   - La búsqueda por raza es case-insensitive (LOWER(raza) = LOWER(@Raza))
 *   - Si la mascota no tiene raza o es 'mestizo', solo se devuelven genéricos
 */

import { getPool, sql } from '../config/database.js';

/**
 * getMascotaConsejos(userId, mascotaId)
 * Devuelve los datos de la mascota + sus consejos correspondientes.
 *
 * @param {number} userId    - ID del usuario autenticado
 * @param {number} mascotaId - ID de la mascota
 * @returns {{ mascota: object, consejos: object[] } | null}
 *   null  → mascota no encontrada
 *   { mascota, consejos: [] } → mascota encontrada pero sin consejos en DB
 *   { mascota, consejos: [...] } → resultado completo
 * @throws Si la mascota existe pero no pertenece al usuario → error con status 403
 */
export async function getMascotaConsejos(userId, mascotaId) {
  const pool = await getPool();

  // ── Query 1: verificar que la mascota existe ──────────────────────────────
  const mascotaResult = await pool.request()
    .input('MascotaId', sql.Int, mascotaId)
    .query(`
      SELECT
        Id_Mascota  AS id,
        Id_User     AS usuario_id,
        Nombre      AS nombre,
        Especie     AS especie,
        Raza        AS raza,
        Peso        AS peso,
        FechaNacimiento AS fecha_nacimiento,
        Foto        AS foto_url
      FROM Mascota
      WHERE Id_Mascota = @MascotaId
    `);

  if (mascotaResult.recordset.length === 0) {
    return null; // → 404
  }

  const mascotaRow = mascotaResult.recordset[0];

  // Verificar que pertenece al usuario autenticado
  if (mascotaRow.usuario_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  const mascota = {
    id: mascotaRow.id,
    nombre: mascotaRow.nombre ?? '',
    especie: (mascotaRow.especie ?? '').toLowerCase(),
    raza: mascotaRow.raza ?? null,
    peso: mascotaRow.peso ?? null,
    fecha_nacimiento: mascotaRow.fecha_nacimiento
      ? mascotaRow.fecha_nacimiento.toISOString().split('T')[0]
      : null,
    fotoUrl: mascotaRow.foto_url ?? null,
  };

  // ── Query 2: consejos de la especie + raza (prioridad) ───────────────────
  // Si la mascota no tiene raza o es 'mestizo', solo buscar por especie (raza IS NULL)
  const tienRaza =
    mascota.raza && mascota.raza.toLowerCase() !== 'mestizo';

  let consejos = [];

  if (tienRaza) {
    // Buscar específicos de raza + genéricos de especie en una sola query
    // Orden: primero los de raza (0), luego los genéricos (1), ambos por orden ASC
    const consejosResult = await pool.request()
      .input('Especie', sql.NVarChar(50), mascota.especie)
      .input('Raza', sql.NVarChar(100), mascota.raza)
      .query(`
        SELECT
          Id_Consejo  AS id,
          Especie     AS especie,
          Raza        AS raza,
          Categoria   AS categoria,
          Contenido   AS contenido,
          Orden       AS orden
        FROM Consejos
        WHERE LOWER(Especie) = LOWER(@Especie)
          AND Activo = 1
          AND (
            LOWER(Raza) = LOWER(@Raza)
            OR Raza IS NULL
          )
        ORDER BY
          CASE WHEN Raza IS NOT NULL THEN 0 ELSE 1 END,
          Orden ASC
      `);
    consejos = consejosResult.recordset;
  } else {
    // Solo genéricos de la especie
    const consejosResult = await pool.request()
      .input('Especie', sql.NVarChar(50), mascota.especie)
      .query(`
        SELECT
          Id_Consejo  AS id,
          Especie     AS especie,
          Raza        AS raza,
          Categoria   AS categoria,
          Contenido   AS contenido,
          Orden       AS orden
        FROM Consejos
        WHERE LOWER(Especie) = LOWER(@Especie)
          AND Activo = 1
          AND Raza IS NULL
        ORDER BY Orden ASC
      `);
    consejos = consejosResult.recordset;
  }

  // Normalizar los campos de cada consejo
  const consejosNormalizados = consejos.map((c) => ({
    id: c.id,
    especie: (c.especie ?? '').toLowerCase(),
    raza: c.raza ?? null,
    categoria: (c.categoria ?? 'general').toLowerCase(),
    contenido: c.contenido ?? '',
    orden: c.orden ?? 0,
  }));

  return { mascota, consejos: consejosNormalizados };
}
