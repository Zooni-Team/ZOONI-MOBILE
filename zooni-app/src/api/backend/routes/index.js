/**
 * src/api/backend/routes/index.js
 *
 * Punto de entrada del router principal del backend de Zooni.
 * Monta todos los sub-routers bajo el prefijo /api/v1.
 *
 * Uso en app.js / server.js:
 *   const routes = require('./routes');
 *   app.use('/api/v1', routes);
 */

'use strict';

const express = require('express');
const router = express.Router();

// Sub-routers del módulo Comunidad
const comunidadRouter = require('./comunidad');

// Sub-router del módulo Ubicación
const ubicacionRouter = require('./ubicacion');

// Sub-router del módulo Amigos
const amigosRouter = require('./amigos');

// Sub-router del módulo Usuarios
const usuariosRouter = require('./usuarios');

// Montar rutas del módulo comunidad bajo /api/v1/comunidad
// (ej: GET /api/v1/comunidad/mapa)
router.use('/comunidad', comunidadRouter);

// Montar rutas de carteles directamente bajo /api/v1
// (ej: POST /api/v1/carteles, DELETE /api/v1/carteles/:id)
router.use('/', comunidadRouter);

// Montar rutas de ubicación directamente bajo /api/v1
// (ej: PUT /api/v1/ubicacion)
router.use('/', ubicacionRouter);

// Montar rutas de amigos directamente bajo /api/v1
// (ej: GET /api/v1/amigos)
router.use('/', amigosRouter);

// Montar rutas de usuarios bajo /api/v1/usuarios
// (ej: GET /api/v1/usuarios/buscar)
router.use('/usuarios', usuariosRouter);

module.exports = router;
