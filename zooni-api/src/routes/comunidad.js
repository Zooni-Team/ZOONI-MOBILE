import express from 'express';
import * as svc from '../services/comunidadService.js';

// Demo: sin auth — usa el primer usuario disponible de la BD
async function demoUser(req, res, next) {
  req.demoUserId = parseInt(process.env.DEMO_USER_ID || '1');
  next();
}

const router = express.Router();

// GET /api/v1/comunidad/mapa
router.get('/mapa', demoUser, async (req, res) => {
  try {
    const { lat_min, lat_max, lng_min, lng_max } = req.query;
    if (!lat_min || !lat_max || !lng_min || !lng_max) {
      return res.status(400).json({ error: 'Faltan parámetros de bounding box' });
    }
    const data = await svc.getMapaData({ lat_min, lat_max, lng_min, lng_max });
    res.json(data);
  } catch (err) {
    console.error('Error en GET /comunidad/mapa:', err);
    // Si la DB no está disponible, devolver datos vacíos en vez de 500
    if (err.code === 'ESOCKET' || err.code === 'ECONNREFUSED' ||
        err.originalError?.code === 'ESOCKET' || err.message?.includes('Failed to connect')) {
      return res.json({ servicios: [], carteles: [], amigos: [] });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/v1/comunidad/servicios
router.get('/servicios', demoUser, async (req, res) => {
  try {
    const { lat_min, lat_max, lng_min, lng_max } = req.query;
    if (!lat_min || !lat_max || !lng_min || !lng_max) {
      return res.status(400).json({ error: 'Faltan parámetros de bounding box' });
    }
    const data = await svc.getMapaData({ lat_min, lat_max, lng_min, lng_max });
    res.json({ servicios: data.servicios });
  } catch (err) {
    console.error('Error en GET /comunidad/servicios:', err);
    if (err.code === 'ESOCKET' || err.code === 'ECONNREFUSED' ||
        err.originalError?.code === 'ESOCKET' || err.message?.includes('Failed to connect')) {
      return res.json({ servicios: [] });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
