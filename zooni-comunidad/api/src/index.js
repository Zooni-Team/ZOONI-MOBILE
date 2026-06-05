require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const mapaRoutes     = require('./routes/mapa');
const cartelesRoutes = require('./routes/carteles');
const amigosRoutes   = require('./routes/amigos');
const ubicacionRoutes = require('./routes/ubicacion');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir fotos de carteles
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rutas ─────────────────────────────────────────────────────────────────
app.use('/api/v1/comunidad', mapaRoutes);
app.use('/api/v1/carteles',  cartelesRoutes);
app.use('/api/v1/amigos',    amigosRoutes);
app.use('/api/v1/ubicacion', ubicacionRoutes);
app.use('/api/v1/usuarios',  usuariosRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'zooni-comunidad-api' }));

app.listen(PORT, () => {
  console.log(`🚀 Zooni Comunidad API corriendo en http://localhost:${PORT}`);
});
