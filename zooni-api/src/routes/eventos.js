import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getEventos } from '../controllers/eventosController.js';

const router = express.Router();

router.get('/', authenticateToken, getEventos);

export default router;
