/**
 * routes/publicaciones.js — Endpoints de publicaciones
 *
 * POST /api/v1/publicaciones   → crear una nueva publicación (multipart/form-data)
 */

import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import { uploadImagen, buildFileUrl }   from '../middleware/upload.js';
import * as svc                         from '../services/publicacionesService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/publicaciones
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, (req, res, next) => {
  // Manejar errores de multer antes de llegar al handler principal
  uploadImagen(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'La imagen supera el límite de 10 MB' });
      }
      return res.status(400).json({ error: err.message ?? 'Error al procesar la imagen' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'La imagen es requerida para publicar' });
    }

    const userId     = getUserId(req);
    const imagenUrl  = buildFileUrl(req, req.file, 'publicaciones');
    const descripcion = req.body.descripcion?.trim() || null;

    const data = await svc.crearPublicacionAsync(userId, imagenUrl, descripcion);

    res.status(201).json({
      mensaje:     'Publicación creada correctamente',
      publicacion: data.publicacion,
    });
  } catch (err) {
    console.error('Error en POST /publicaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
