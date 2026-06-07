import express from 'express';
import multer from 'multer';
import * as svc from '../services/comunidadService.js';

const router = express.Router();
const upload = multer();

// Demo: sin auth — usa el primer usuario disponible
function demoUser(req, res, next) {
  req.demoUserId = parseInt(process.env.DEMO_USER_ID || '1');
  next();
}

// POST /api/v1/carteles
router.post('/', demoUser, upload.single('foto'), async (req, res) => {
  try {
    const userId = req.demoUserId;
    const { tipo, descripcion, telefono_contacto, lat, lng } = req.body;

    if (!tipo || !telefono_contacto || lat == null || lng == null) {
      return res.status(400).json({ error: 'Faltan campos requeridos: tipo, telefono_contacto, lat, lng' });
    }

    const cartel = await svc.crearCartel(userId, { tipo, descripcion, telefono_contacto, lat, lng });
    res.status(201).json({ mensaje: 'Cartel creado exitosamente', cartel });
  } catch (err) {
    console.error('Error en POST /carteles:', err);
    const isDbDown = err.code === 'ESOCKET' || err.code === 'ECONNREFUSED' ||
      err.originalError?.code === 'ESOCKET' || err.message?.includes('Failed to connect');
    if (isDbDown) {
      return res.status(201).json({
        mensaje: 'Cartel creado exitosamente (demo)',
        cartel: {
          id: Date.now(),
          tipo: req.body.tipo,
          descripcion: req.body.descripcion || null,
          telefono_contacto: req.body.telefono_contacto,
          lat: parseFloat(req.body.lat),
          lng: parseFloat(req.body.lng),
          created_at: new Date().toISOString(),
        },
      });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/v1/carteles/:id
router.delete('/:id', demoUser, async (req, res) => {
  try {
    const userId = req.demoUserId;
    const result = await svc.eliminarCartel(userId, parseInt(req.params.id));

    if (result.notFound) return res.status(404).json({ error: 'Cartel no encontrado' });
    if (result.forbidden) return res.status(403).json({ error: 'No tenés permiso para eliminar este cartel' });

    res.json({ mensaje: 'Cartel eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /carteles:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
