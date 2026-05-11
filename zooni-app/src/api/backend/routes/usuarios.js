/**
 * src/api/backend/routes/usuarios.js
 *
 * Rutas del módulo Usuarios — Zooni Backend
 *
 * Endpoints:
 *   GET /api/v1/usuarios/buscar?q=<texto>  — búsqueda de usuarios por nombre o mascota
 *
 * Auth: JWT requerido (req.user.id disponible via middleware)
 */

'use strict';

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/v1/usuarios/buscar
// ---------------------------------------------------------------------------

/**
 * Busca usuarios por nombre o nombre de mascota principal.
 *
 * Query params:
 *   q  {string}  — texto de búsqueda (mínimo 2 caracteres)
 *
 * Respuesta 200:
 *   {
 *     resultados: [
 *       {
 *         usuario_id:     string,
 *         nombre:         string,
 *         foto_perfil_url: string | null,
 *         mascota_nombre: string | null,
 *         barrio:         string | null,
 *         es_amigo:       boolean
 *       }
 *     ]
 *   }
 *
 * Si q está ausente o tiene menos de 2 caracteres → { resultados: [] }
 * Máximo 20 resultados. El usuario autenticado no aparece en los resultados.
 */
router.get('/buscar', async (req, res) => {
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;

  const q = req.query.q;

  // ── 1. Validar parámetro q ─────────────────────────────────────────────────
  // Si falta o tiene menos de 2 caracteres → devolver lista vacía
  if (!q || q.trim().length < 2) {
    return res.json({ resultados: [] });
  }

  const termino = q.trim();
  const patron = `%${termino}%`;

  try {
    // ── 2. Buscar usuarios por nombre o nombre de mascota principal ──────────
    //
    // La subconsulta EXISTS verifica si existe una amistad ACEPTADA entre el
    // usuario autenticado y el usuario resultado (en cualquier dirección).
    //
    // Se excluye al propio usuario autenticado (u.id != ?).
    // Se hace LEFT JOIN con mascotas filtrando solo la mascota principal.
    // LIMIT 20 para no sobrecargar la respuesta.
    const [rows] = await db.query(
      `SELECT
         u.id              AS usuario_id,
         u.nombre,
         u.foto_perfil_url,
         m.nombre          AS mascota_nombre,
         u.barrio,
         EXISTS(
           SELECT 1 FROM amistades a
           WHERE ((a.usuario_a_id = ? AND a.usuario_b_id = u.id)
               OR (a.usuario_b_id = ? AND a.usuario_a_id = u.id))
             AND a.estado = 'aceptada'
         ) AS es_amigo
       FROM usuarios u
       LEFT JOIN mascotas m ON m.usuario_id = u.id AND m.principal = TRUE
       WHERE (u.nombre LIKE ? OR m.nombre LIKE ?)
         AND u.id != ?
       LIMIT 20`,
      [
        usuarioId,   // EXISTS: usuario_a_id = ?
        usuarioId,   // EXISTS: usuario_b_id = ?
        patron,      // u.nombre LIKE ?
        patron,      // m.nombre LIKE ?
        usuarioId,   // u.id != ?
      ]
    );

    // ── 3. Convertir es_amigo de 1/0 a boolean ────────────────────────────────
    const resultados = rows.map((row) => ({
      ...row,
      es_amigo: Boolean(row.es_amigo),
    }));

    // ── 4. Responder ──────────────────────────────────────────────────────────
    return res.json({ resultados });
  } catch (err) {
    console.error('[GET /usuarios/buscar] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
