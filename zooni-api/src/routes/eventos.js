import express from 'express';
import { authenticateToken, getUserId } from '../middleware/auth.js';
import {
  getEventosAsync,
  createEventoAsync,
  updateEventoAsync,
  deleteEventoAsync,
} from '../services/eventosService.js';

const router = express.Router({ mergeParams: true }); // hereda :petId de mascotas

// ── Helper para manejar errores de servicio ────────────────────────────────────
const handleError = (res, err) => {
  console.error('Eventos error:', err);
  if (err.status && err.message) {
    return res.status(err.status).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Error interno del servidor' });
};

// ── GET /api/v1/mascotas/:petId/eventos ────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const eventos = await getEventosAsync(petId, userId);
    res.json({ eventos });
  } catch (err) {
    handleError(res, err);
  }
});

// ── POST /api/v1/mascotas/:petId/eventos ───────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const evento = await createEventoAsync(petId, userId, req.body);
    res.status(201).json({ mensaje: 'Evento registrado correctamente', evento });
  } catch (err) {
    handleError(res, err);
  }
});

// ── PUT /api/v1/mascotas/:petId/eventos/:eventoId ──────────────────────────────
router.put('/:eventoId', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const eventoId = parseInt(req.params.eventoId);
    const evento = await updateEventoAsync(petId, eventoId, userId, req.body);
    res.json({ mensaje: 'Evento actualizado correctamente', evento });
  } catch (err) {
    handleError(res, err);
  }
});

// ── DELETE /api/v1/mascotas/:petId/eventos/:eventoId ──────────────────────────
router.delete('/:eventoId', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const petId = parseInt(req.params.petId);
    const eventoId = parseInt(req.params.eventoId);
    await deleteEventoAsync(petId, eventoId, userId);
    res.json({ mensaje: 'Evento eliminado correctamente' });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
