import express from 'express';
import { loginAsync } from '../services/authService.js';

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const token = await loginAsync(email, password);

    if (!token) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    res.json({ token });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
