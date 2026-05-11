/**
 * src/api/backend/routes/amigos.js
 *
 * Rutas del módulo Amigos — Zooni Backend
 *
 * Endpoints:
 *   GET /api/v1/amigos  — lista de amigos confirmados con distancia y estado online
 *
 * Auth: JWT requerido (req.user.id disponible via middleware)
 */

'use strict';

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/v1/amigos
// ---------------------------------------------------------------------------

/**
 * Devuelve la lista de amigos confirmados del usuario autenticado con:
 * - Información básica del amigo (nombre, foto_perfil_url)
 * - Nombre de su mascota principal
 * - Distancia en km desde la ubicación actual del usuario autenticado
 * - Estado online (TRUE si updated_at < 5 minutos, FALSE en caso contrario)
 * - Coordenadas lat/lng del amigo
 *
 * Si el usuario autenticado no tiene ubicación registrada, las distancias
 * se devuelven como null.
 *
 * Respuesta 200:
 *   [
 *     {
 *       usuario_id: string,
 *       nombre: string,
 *       foto_perfil_url: string | null,
 *       mascota_nombre: string | null,
 *       distancia: number | null,  // km, redondeado a 1 decimal
 *       online: boolean,
 *       lat: number,
 *       lng: number
 *     }
 *   ]
 */
router.get('/amigos', async (req, res) => {
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;

  try {
    // ── 1. Obtener la ubicación actual del usuario autenticado ─────────────
    const [ubicacionUsuario] = await db.query(
      `SELECT ST_X(ubicacion) AS lng, ST_Y(ubicacion) AS lat
       FROM ubicaciones_usuarios
       WHERE usuario_id = ?`,
      [usuarioId]
    );

    const miUbicacion = ubicacionUsuario[0] || null;

    // ── 2. Query amigos confirmados con distancia y estado online ──────────
    //
    // Solo se incluyen usuarios que:
    //   a) Tienen una amistad ACEPTADA con el usuario autenticado (en cualquier
    //      dirección: usuario_a_id o usuario_b_id puede ser el autenticado).
    //   b) Tienen compartir_ubicacion = TRUE en ubicaciones_usuarios.
    //
    // Distancia:
    //   - Si el usuario autenticado tiene ubicación → calcular con ST_Distance_Sphere
    //   - Si no tiene ubicación → devolver NULL
    //
    // Estado online:
    //   - Si updated_at de ubicaciones_usuarios es menor a 5 minutos → online = TRUE
    //   - En caso contrario → online = FALSE

    let query;
    let params;

    if (miUbicacion) {
      // Usuario autenticado tiene ubicación → calcular distancias
      query = `
        SELECT
          uu.usuario_id,
          u.nombre,
          u.foto_perfil_url,
          m.nombre AS mascota_nombre,
          ST_X(uu.ubicacion) AS lng,
          ST_Y(uu.ubicacion) AS lat,
          ROUND(
            ST_Distance_Sphere(
              uu.ubicacion,
              ST_GeomFromText(?)
            ) / 1000,
            1
          ) AS distancia,
          CASE
            WHEN TIMESTAMPDIFF(MINUTE, uu.updated_at, NOW()) < 5 THEN TRUE
            ELSE FALSE
          END AS online
        FROM ubicaciones_usuarios uu
        JOIN usuarios u ON u.id = uu.usuario_id
        LEFT JOIN mascotas m ON m.usuario_id = u.id AND m.principal = TRUE
        JOIN amistades a ON (
          (a.usuario_a_id = ? AND a.usuario_b_id = uu.usuario_id)
          OR
          (a.usuario_b_id = ? AND a.usuario_a_id = uu.usuario_id)
        )
        WHERE uu.compartir_ubicacion = TRUE
          AND a.estado = 'aceptada'
        ORDER BY distancia ASC
      `;

      params = [
        `POINT(${miUbicacion.lng} ${miUbicacion.lat})`,
        usuarioId,
        usuarioId,
      ];
    } else {
      // Usuario autenticado NO tiene ubicación → distancias NULL
      query = `
        SELECT
          uu.usuario_id,
          u.nombre,
          u.foto_perfil_url,
          m.nombre AS mascota_nombre,
          ST_X(uu.ubicacion) AS lng,
          ST_Y(uu.ubicacion) AS lat,
          NULL AS distancia,
          CASE
            WHEN TIMESTAMPDIFF(MINUTE, uu.updated_at, NOW()) < 5 THEN TRUE
            ELSE FALSE
          END AS online
        FROM ubicaciones_usuarios uu
        JOIN usuarios u ON u.id = uu.usuario_id
        LEFT JOIN mascotas m ON m.usuario_id = u.id AND m.principal = TRUE
        JOIN amistades a ON (
          (a.usuario_a_id = ? AND a.usuario_b_id = uu.usuario_id)
          OR
          (a.usuario_b_id = ? AND a.usuario_a_id = uu.usuario_id)
        )
        WHERE uu.compartir_ubicacion = TRUE
          AND a.estado = 'aceptada'
        ORDER BY u.nombre ASC
      `;

      params = [usuarioId, usuarioId];
    }

    const [amigos] = await db.query(query, params);

    // ── 3. Convertir online de 1/0 a boolean ───────────────────────────────
    const amigosFormateados = amigos.map((amigo) => ({
      ...amigo,
      online: Boolean(amigo.online),
    }));

    // ── 4. Responder ────────────────────────────────────────────────────────
    return res.json(amigosFormateados);
  } catch (err) {
    console.error('[GET /amigos] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/amigos/solicitud
// ---------------------------------------------------------------------------

/**
 * Envía una solicitud de amistad al usuario destino.
 *
 * Body: { usuario_destino_id: string }
 *
 * Respuestas:
 *   201 { mensaje: 'Solicitud enviada' }
 *   400 si falta usuario_destino_id o es igual al usuario autenticado
 *   409 si ya existe una solicitud o amistad entre los dos usuarios
 *   500 error interno
 */
router.post('/amigos/solicitud', async (req, res) => {
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;
  const { usuario_destino_id } = req.body;

  // ── 1. Validar body ────────────────────────────────────────────────────────
  if (!usuario_destino_id) {
    return res.status(400).json({ error: 'usuario_destino_id es requerido.' });
  }

  if (usuario_destino_id === usuarioId) {
    return res.status(400).json({ error: 'No podés enviarte una solicitud a vos mismo.' });
  }

  try {
    // ── 2. Verificar duplicado en ambas direcciones ────────────────────────
    const [existentes] = await db.query(
      `SELECT id FROM amistades
       WHERE (usuario_a_id = ? AND usuario_b_id = ?)
          OR (usuario_a_id = ? AND usuario_b_id = ?)
       LIMIT 1`,
      [usuarioId, usuario_destino_id, usuario_destino_id, usuarioId]
    );

    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe una solicitud o ya son amigos' });
    }

    // ── 3. Insertar solicitud ──────────────────────────────────────────────
    await db.query(
      `INSERT INTO amistades (usuario_a_id, usuario_b_id, estado)
       VALUES (?, ?, 'pendiente')`,
      [usuarioId, usuario_destino_id]
    );

    return res.status(201).json({ mensaje: 'Solicitud enviada' });
  } catch (err) {
    console.error('[POST /amigos/solicitud] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/amigos/solicitud/:id
// ---------------------------------------------------------------------------

/**
 * Acepta o rechaza una solicitud de amistad recibida.
 *
 * Params: id — ID de la solicitud (amistad)
 * Body:   { accion: 'aceptar' | 'rechazar' }
 *
 * Respuestas:
 *   200 { mensaje: 'Solicitud actualizada' }
 *   400 si accion no es válida
 *   403 si el usuario autenticado no es el destinatario de la solicitud
 *   404 si la solicitud no existe
 *   500 error interno
 */
router.patch('/amigos/solicitud/:id', async (req, res) => {
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;
  const { id } = req.params;
  const { accion } = req.body;

  // ── 1. Validar accion ──────────────────────────────────────────────────────
  if (!accion || !['aceptar', 'rechazar'].includes(accion)) {
    return res.status(400).json({ error: 'accion debe ser "aceptar" o "rechazar".' });
  }

  try {
    // ── 2. Buscar la solicitud ─────────────────────────────────────────────
    const [solicitudes] = await db.query(
      `SELECT id, usuario_a_id, usuario_b_id, estado
       FROM amistades
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (solicitudes.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    const solicitud = solicitudes[0];

    // ── 3. Verificar que el usuario autenticado es el destinatario ─────────
    if (solicitud.usuario_b_id !== usuarioId) {
      return res.status(403).json({ error: 'No tenés permiso para responder esta solicitud.' });
    }

    // ── 4. Actualizar estado ───────────────────────────────────────────────
    const nuevoEstado = accion === 'aceptar' ? 'aceptada' : 'rechazada';

    await db.query(
      `UPDATE amistades SET estado = ? WHERE id = ?`,
      [nuevoEstado, id]
    );

    return res.status(200).json({ mensaje: 'Solicitud actualizada' });
  } catch (err) {
    console.error('[PATCH /amigos/solicitud/:id] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
