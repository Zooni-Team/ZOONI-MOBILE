import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import * as homeService from '../services/homeService.js';

const router = express.Router();

// PATCH /api/v1/mascotas/:id/activar
router.patch('/:id/activar', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const mascotaId = parseInt(req.params.id);

    const ok = await homeService.activarMascotaAsync(userId, mascotaId);

    if (!ok) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    res.json({ mensaje: 'Mascota activa actualizada', mascota_id: mascotaId });
  } catch (error) {
    console.error('Error en PATCH /mascotas/:id/activar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
