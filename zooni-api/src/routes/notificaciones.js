import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import * as notificacionService from '../services/notificacionService.js';

const router = express.Router();

// GET /api/v1/notificaciones?page=1&limit=20&leidas=false
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const soloNoLeidas = req.query.leidas === 'false';

    const result = await notificacionService.getNotificacionesAsync(
      userId,
      page,
      limit,
      soloNoLeidas
    );

    res.json(result);
  } catch (error) {
    console.error('Error en GET /notificaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/v1/notificaciones/:id/leer
router.patch('/:id/leer', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notifId = parseInt(req.params.id);

    const ok = await notificacionService.marcarLeidaAsync(userId, notifId);

    if (!ok) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ mensaje: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error en PATCH /notificaciones/:id/leer:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/v1/notificaciones/leer-todas
router.patch('/leer-todas', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const count = await notificacionService.marcarTodasLeidasAsync(userId);

    res.json({
      mensaje: 'Todas las notificaciones marcadas como leídas',
      actualizadas: count,
    });
  } catch (error) {
    console.error('Error en PATCH /notificaciones/leer-todas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
