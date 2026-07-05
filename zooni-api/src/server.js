import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Rutas
import authRoutes from './routes/auth.js';
import homeRoutes from './routes/home.js';
import mascotasRoutes from './routes/mascotas.js';
import avataresRoutes from './routes/avatares.js';
import notificacionesRoutes from './routes/notificaciones.js';
import comunidadRoutes from './routes/comunidad.js';
import cartelesRoutes from './routes/carteles.js';
import amigosRoutes from './routes/amigos.js';
import ubicacionRoutes from './routes/ubicacion.js';
import usuariosRoutes from './routes/usuarios.js';
import eventosRoutes from './routes/eventos.js';
import calendarioEventosRoutes from './routes/calendarioEventos.js';
import perfilRoutes from './routes/perfil.js';
import publicacionesRoutes from './routes/publicaciones.js';

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// CORS - permitir todos los orígenes en desarrollo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos — imágenes subidas por usuarios
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── RUTAS ────────────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/home', homeRoutes);
app.use('/api/v1/mascotas', mascotasRoutes);
app.use('/api/v1/mascotas', avataresRoutes);
app.use('/api/v1/notificaciones', notificacionesRoutes);
app.use('/api/v1/comunidad', comunidadRoutes);
app.use('/api/v1/carteles', cartelesRoutes);
app.use('/api/v1/amigos', amigosRoutes);
app.use('/api/v1/ubicacion', ubicacionRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);
app.use('/api/v1/eventos', eventosRoutes);
app.use('/api/v1/mascotas', calendarioEventosRoutes);
app.use('/api/v1/perfil', perfilRoutes);
app.use('/api/v1/publicaciones', publicacionesRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'Zooni API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      home: '/api/v1/home',
      mascotas: '/api/v1/mascotas',
      notificaciones: '/api/v1/notificaciones',
    },
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── INICIAR SERVIDOR ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                       ZOONI API                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📱 Para Android Emulator: http://10.0.2.2:${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('Endpoints disponibles:');
  console.log(`  POST   /api/v1/auth/login`);
  console.log(`  GET    /api/v1/home`);
  console.log(`  GET    /api/v1/home/config`);
  console.log(`  PUT    /api/v1/home/config`);
  console.log(`  PATCH  /api/v1/mascotas/:id/activar`);
  console.log(`  GET    /api/v1/notificaciones`);
  console.log(`  PATCH  /api/v1/notificaciones/:id/leer`);
  console.log(`  GET    /api/v1/eventos`);
  console.log(`  POST   /api/v1/mascotas/:petId/eventos`);
  console.log(`  PATCH  /api/v1/notificaciones/leer-todas`);
  console.log(`  GET    /api/v1/perfil`);
  console.log(`  PUT    /api/v1/perfil`);
  console.log(`  PUT    /api/v1/perfil/foto`);
  console.log(`  GET    /api/v1/perfil/publicaciones`);
  console.log(`  POST   /api/v1/publicaciones`);
  console.log(`  GET    /uploads/perfiles/:filename`);
  console.log(`  GET    /uploads/publicaciones/:filename`);
  console.log('');
  console.log('Presiona Ctrl+C para detener el servidor');
  console.log('');
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Cerrando servidor...');
  process.exit(0);
});
