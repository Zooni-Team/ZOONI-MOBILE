/**
 * consejos.js — Rutas de Consejos y Curiosidades
 *
 * Todas las rutas son de SOLO LECTURA (GET).
 * Los usuarios no pueden crear, editar ni eliminar consejos.
 *
 * Prefijo registrado en server.js: /api/v1/mascotas
 * Ruta completa: GET /api/v1/mascotas/:petId/consejos
 */

import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import * as consejosService from '../services/consejosService.js';

const router = express.Router();

/**
 * GET /api/v1/mascotas/:petId/consejos
 *
 * Devuelve los datos de la mascota y sus consejos/curiosidades.
 * Solo devuelve consejos de la especie + raza de la mascota.
 * Específicos de raza primero, genéricos de especie después.
 *
 * Requiere: Authorization: Bearer <token>
 *
 * Respuestas:
 *   200 — { mascota, consejos: [...] }
 *   403 — { error: "No tenés permiso para ver esta mascota" }
 *   404 — { error: "Mascota no encontrada" }
 *   500 — { error: "Error interno del servidor" }
 */
router.get('/:petId/consejos', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId, 10);

    if (isNaN(petId) || petId <= 0) {
      return res.status(400).json({ error: 'ID de mascota inválido' });
    }

    const resultado = await consejosService.getMascotaConsejos(userId, petId);

    if (resultado === null) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    return res.json(resultado);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: 'No tenés permiso para ver esta mascota' });
    }
    console.error('Error en GET /mascotas/:petId/consejos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
