import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAvatares, putAvatar } from '../controllers/avatarController.js';

const router = express.Router();

// GET /api/v1/mascotas/:petId/avatares
router.get('/:petId/avatares', authenticateToken, getAvatares);

// PUT /api/v1/mascotas/:petId/avatar
router.put('/:petId/avatar', authenticateToken, putAvatar);

export default router;
