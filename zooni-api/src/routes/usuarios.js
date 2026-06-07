import express from 'express';
import * as svc from '../services/comunidadService.js';

const router = express.Router();

function demoUser(req, res, next) {
  req.demoUserId = parseInt(process.env.DEMO_USER_ID || '1');
  next();
}

// GET /api/v1/usuarios/buscar?q=...
router.get('/buscar', demoUser, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'El parámetro q debe tener al menos 2 caracteres' });

    const resultados = await svc.buscarUsuarios(req.demoUserId, q);
    res.json({ resultados });
  } catch (err) {
    console.error('Error en GET /usuarios/buscar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
