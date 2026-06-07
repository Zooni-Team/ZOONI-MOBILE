import express from 'express';
import * as svc from '../services/comunidadService.js';

const router = express.Router();

function demoUser(req, res, next) {
  req.demoUserId = parseInt(process.env.DEMO_USER_ID || '1');
  next();
}

// PUT /api/v1/ubicacion
router.put('/', demoUser, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'Faltan lat y lng' });

    await svc.actualizarUbicacion(req.demoUserId, parseFloat(lat), parseFloat(lng));
    res.json({ mensaje: 'Ubicación actualizada' });
  } catch (err) {
    console.error('Error en PUT /ubicacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
