/**
 * routes/perfil.js — Endpoints del perfil del usuario autenticado
 *
 * Todas las rutas requieren JWT válido (authenticateToken).
 *
 * GET  /api/v1/perfil                    → perfil + estadísticas
 * PUT  /api/v1/perfil                    → actualizar datos de texto
 * PUT  /api/v1/perfil/foto               → actualizar foto de perfil (multipart)
 * GET  /api/v1/perfil/publicaciones      → publicaciones propias
 */

import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import { uploadFoto, buildFileUrl }     from '../middleware/upload.js';
import * as svc                         from '../services/perfilService.js';
import * as pubSvc                      from '../services/publicacionesService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/perfil
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const data   = await svc.getPerfilAsync(userId);

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/perfil
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { nombre, apellido, nombre_usuario, bio, ubicacion } = req.body;

    const result = await svc.updatePerfilAsync(userId, {
      nombre, apellido, nombre_usuario, bio, ubicacion,
    });

    if (!result) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (result.badRequest) {
      return res.status(400).json({ error: result.badRequest });
    }
    if (result.conflict) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    res.json({
      mensaje: 'Perfil actualizado correctamente',
      perfil:  result.perfil,
    });
  } catch (err) {
    console.error('Error en PUT /perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/perfil/foto
// ─────────────────────────────────────────────────────────────────────────────
router.put('/foto', authenticateToken, (req, res, next) => {
  // Manejar errores de multer antes de llegar al handler principal
  uploadFoto(req, res, (err) => {
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
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    const userId  = getUserId(req);
    const fotoUrl = buildFileUrl(req, req.file, 'perfiles');
    const result  = await svc.updateFotoPerfilAsync(userId, fotoUrl);

    if (!result) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      mensaje:         'Foto actualizada correctamente',
      foto_perfil_url: result.foto_perfil_url,
    });
  } catch (err) {
    console.error('Error en PUT /perfil/foto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/perfil/publicaciones
// ─────────────────────────────────────────────────────────────────────────────
router.get('/publicaciones', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const data   = await pubSvc.getPublicacionesAsync(userId);
    res.json(data);
  } catch (err) {
    console.error('Error en GET /perfil/publicaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
