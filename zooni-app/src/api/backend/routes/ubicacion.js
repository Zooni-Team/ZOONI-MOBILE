/**
 * src/api/backend/routes/ubicacion.js
 *
 * Rutas del módulo Ubicación — Zooni Backend
 *
 * Endpoints:
 *   PUT /api/v1/ubicacion  — actualiza la ubicación del usuario autenticado
 *                            de forma asíncrona (no bloqueante)
 *
 * Auth: JWT requerido (req.user.id disponible via middleware)
 */

'use strict';

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers de validación
// ---------------------------------------------------------------------------

/**
 * Valida que un valor sea un número finito (no NaN, no Infinity).
 * Acepta tanto números como strings numéricos.
 *
 * @param {*} value
 * @returns {number|null}  — número parseado o null si inválido
 */
function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// PUT /api/v1/ubicacion
// ---------------------------------------------------------------------------

/**
 * Actualiza la ubicación geográfica del usuario autenticado.
 *
 * La verificación de `compartir_ubicacion` y la escritura en BD se realizan
 * de forma asíncrona con `setImmediate` para no bloquear el hilo principal.
 * La respuesta 200 se envía de inmediato, antes de que la escritura termine.
 *
 * Body JSON:
 *   lat  {number}  requerido — latitud válida
 *   lng  {number}  requerido — longitud válida
 *
 * Respuesta 200:
 *   { mensaje: 'Ubicación actualizada' }
 *
 * Respuesta 400:
 *   { errores: [{ campo, mensaje }] }
 */
router.put('/ubicacion', (req, res) => {
  // ── 1. Parsear y validar lat / lng ────────────────────────────────────────
  const latNum = parseCoord(req.body.lat);
  const lngNum = parseCoord(req.body.lng);

  const errores = [];

  if (latNum === null) {
    errores.push({
      campo: 'lat',
      mensaje: 'El campo lat es requerido y debe ser un número válido.',
    });
  }

  if (lngNum === null) {
    errores.push({
      campo: 'lng',
      mensaje: 'El campo lng es requerido y debe ser un número válido.',
    });
  }

  if (errores.length > 0) {
    return res.status(400).json({ errores });
  }

  // ── 2. Responder 200 de inmediato (antes de la escritura en BD) ───────────
  res.json({ mensaje: 'Ubicación actualizada' });

  // ── 3. Actualización asíncrona no bloqueante ──────────────────────────────
  //
  // `setImmediate` cede el control al event loop antes de ejecutar el callback,
  // garantizando que la respuesta HTTP ya fue enviada al cliente.
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;

  setImmediate(async () => {
    try {
      // ── 3a. Verificar si el usuario tiene compartir_ubicacion = TRUE ──────
      //
      // Si el registro no existe aún, compartir_ubicacion se asume TRUE
      // (el INSERT posterior lo creará con el valor por defecto TRUE).
      const [rows] = await db.query(
        'SELECT compartir_ubicacion FROM ubicaciones_usuarios WHERE usuario_id = ?',
        [usuarioId]
      );

      const registro = rows[0];

      // Si existe el registro y compartir_ubicacion es FALSE → no actualizar
      if (registro && !registro.compartir_ubicacion) {
        return;
      }

      // ── 3b. Insertar o actualizar la ubicación ────────────────────────────
      //
      // INSERT ... ON DUPLICATE KEY UPDATE garantiza upsert atómico.
      // La PK es usuario_id, por lo que si ya existe el registro se actualiza
      // solo la columna `ubicacion` (y `updated_at` se actualiza automáticamente
      // por el ON UPDATE CURRENT_TIMESTAMP definido en el schema).
      await db.query(
        `INSERT INTO ubicaciones_usuarios (usuario_id, ubicacion)
         VALUES (?, ST_GeomFromText(?))
         ON DUPLICATE KEY UPDATE ubicacion = ST_GeomFromText(?)`,
        [
          usuarioId,
          `POINT(${lngNum} ${latNum})`,
          `POINT(${lngNum} ${latNum})`,
        ]
      );
    } catch (err) {
      // Los errores en el callback asíncrono se loguean pero no afectan
      // la respuesta ya enviada al cliente.
      console.error('[PUT /ubicacion] Error en actualización asíncrona:', err);
    }
  });
});

module.exports = router;
