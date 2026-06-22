import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createEventoCalendario } from '../controllers/eventosController.js';

const router = express.Router();

router.post('/:petId/eventos', authenticateToken, createEventoCalendario);

export default router;
