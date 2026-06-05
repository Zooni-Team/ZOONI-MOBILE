import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import * as homeService from '../services/homeService.js';

const router = express.Router();

// GET /api/v1/home
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = await homeService.getHomeAsync(userId);

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /home:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/v1/home/config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const config = await homeService.getConfigAsync(userId);
    res.json(config);
  } catch (error) {
    console.error('Error en GET /home/config:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/v1/home/config
router.put('/config', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    await homeService.saveConfigAsync(userId, req.body);
    res.json({ mensaje: 'Configuración guardada correctamente' });
  } catch (error) {
    console.error('Error en PUT /home/config:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
