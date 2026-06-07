import express from 'express';
import * as svc from '../services/comunidadService.js';

const router = express.Router();

function demoUser(req, res, next) {
  req.demoUserId = parseInt(process.env.DEMO_USER_ID || '1');
  next();
}

// GET /api/v1/amigos
router.get('/', demoUser, async (req, res) => {
  try {
    const amigos = await svc.getAmigos(req.demoUserId);
    res.json({ amigos });
  } catch (err) {
    console.error('Error en GET /amigos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/v1/amigos/solicitudes
router.get('/solicitudes', demoUser, async (req, res) => {
  try {
    const solicitudes = await svc.getSolicitudes(req.demoUserId);
    res.json({ solicitudes });
  } catch (err) {
    console.error('Error en GET /amigos/solicitudes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/v1/amigos/solicitud
router.post('/solicitud', demoUser, async (req, res) => {
  try {
    const { usuario_destino_id } = req.body;
    if (!usuario_destino_id) return res.status(400).json({ error: 'Falta usuario_destino_id' });

    const result = await svc.enviarSolicitud(req.demoUserId, parseInt(usuario_destino_id));
    if (result.conflict) return res.status(409).json({ error: 'Ya existe una solicitud o ya son amigos' });

    res.status(201).json({ mensaje: 'Solicitud enviada correctamente' });
  } catch (err) {
    console.error('Error en POST /amigos/solicitud:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/v1/amigos/solicitud/:id
router.patch('/solicitud/:id', demoUser, async (req, res) => {
  try {
    const { accion } = req.body;
    if (!accion || !['aceptar', 'rechazar'].includes(accion)) {
      return res.status(400).json({ error: 'accion debe ser "aceptar" o "rechazar"' });
    }

    const ok = await svc.responderSolicitud(req.demoUserId, parseInt(req.params.id), accion);
    if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });

    res.json({ mensaje: accion === 'aceptar' ? '¡Ahora son amigos!' : 'Solicitud rechazada' });
  } catch (err) {
    console.error('Error en PATCH /amigos/solicitud:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
