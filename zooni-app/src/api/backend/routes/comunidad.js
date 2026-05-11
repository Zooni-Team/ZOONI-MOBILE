/**
 * src/api/backend/routes/comunidad.js
 *
 * Rutas del módulo Comunidad — Zooni Backend
 *
 * Endpoints:
 *   GET  /api/v1/comunidad/mapa  — markers de servicios, carteles y amigos
 *                                   filtrados por bounding box (máx 50 total)
 *   POST /api/v1/carteles        — crear un nuevo cartel con foto opcional (multipart/form-data)
 *
 * Auth: JWT requerido en todos los endpoints (req.user.id disponible via middleware)
 */

'use strict';

const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();

// ---------------------------------------------------------------------------
// Configuración de multer para upload de fotos de carteles
// ---------------------------------------------------------------------------

/** Almacenamiento en disco local (MVP) — carpeta uploads/carteles/ */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/carteles/');
  },
  filename: function (req, file, cb) {
    // Nombre único: timestamp + número aleatorio + extensión original
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

/** Filtro: solo imágenes JPEG, PNG y GIF */
function imageFileFilter(req, file, cb) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
  }
}

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// ---------------------------------------------------------------------------
// Helpers de validación
// ---------------------------------------------------------------------------

/**
 * Parsea y valida un parámetro de query como número de punto flotante.
 * @param {string|undefined} value  — valor crudo del query param
 * @returns {number|null}           — número parseado o null si inválido
 */
function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return isFinite(n) ? n : null;
}

/**
 * Valida que los cuatro parámetros del bounding box estén presentes y sean
 * números finitos con rangos geográficos coherentes.
 *
 * @param {{ lat_min, lat_max, lng_min, lng_max }} coords
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBoundingBox(coords) {
  const { lat_min, lat_max, lng_min, lng_max } = coords;

  if (lat_min === null || lat_max === null || lng_min === null || lng_max === null) {
    return { valid: false, error: 'Los parámetros lat_min, lat_max, lng_min y lng_max son requeridos y deben ser números válidos.' };
  }

  if (lat_min < -90 || lat_min > 90 || lat_max < -90 || lat_max > 90) {
    return { valid: false, error: 'Los valores de latitud deben estar entre -90 y 90.' };
  }

  if (lng_min < -180 || lng_min > 180 || lng_max < -180 || lng_max > 180) {
    return { valid: false, error: 'Los valores de longitud deben estar entre -180 y 180.' };
  }

  if (lat_min >= lat_max) {
    return { valid: false, error: 'lat_min debe ser menor que lat_max.' };
  }

  if (lng_min >= lng_max) {
    return { valid: false, error: 'lng_min debe ser menor que lng_max.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// GET /api/v1/comunidad/mapa
// ---------------------------------------------------------------------------

/**
 * Devuelve hasta 50 markers (servicios + carteles + amigos) dentro del
 * bounding box indicado, priorizados por distancia al centro del bbox.
 *
 * Query params:
 *   lat_min  {number}  latitud mínima (sur)
 *   lat_max  {number}  latitud máxima (norte)
 *   lng_min  {number}  longitud mínima (oeste)
 *   lng_max  {number}  longitud máxima (este)
 *
 * Respuesta 200:
 *   {
 *     servicios: ServicioMarker[],
 *     carteles:  CartelMarker[],
 *     amigos:    AmigoMarker[]
 *   }
 */
router.get('/mapa', async (req, res) => {
  // ── 1. Parsear y validar bounding box ──────────────────────────────────────
  const lat_min = parseCoord(req.query.lat_min);
  const lat_max = parseCoord(req.query.lat_max);
  const lng_min = parseCoord(req.query.lng_min);
  const lng_max = parseCoord(req.query.lng_max);

  const validation = validateBoundingBox({ lat_min, lat_max, lng_min, lng_max });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Centro del bounding box — usado para calcular distancias y ordenar
  const centerLat = (lat_min + lat_max) / 2;
  const centerLng = (lng_min + lng_max) / 2;

  // Usuario autenticado (inyectado por el middleware JWT)
  const usuarioId = req.user.id;

  // Referencia a la conexión de base de datos (inyectada en req.db o app.locals.db)
  const db = req.db || req.app.locals.db;

  try {
    // ── 2. Query servicios dentro del bounding box ─────────────────────────
    //
    // MBRContains(poligono, punto) devuelve TRUE si el punto está dentro del
    // rectángulo mínimo delimitador del polígono.
    //
    // El polígono se construye con las 4 esquinas del bbox en sentido horario
    // y cerrando el anillo (primer punto = último punto):
    //   (lng_min lat_min, lng_max lat_min, lng_max lat_max, lng_min lat_max, lng_min lat_min)
    //
    // ST_Distance devuelve la distancia en grados; para MVP es suficiente para
    // ordenar por proximidad. Para distancias en km usar ST_Distance_Sphere.
    const [servicios] = await db.query(
      `SELECT
         s.id,
         s.tipo,
         s.nombre,
         s.direccion,
         s.telefono,
         s.descripcion,
         ST_X(s.ubicacion)  AS lng,
         ST_Y(s.ubicacion)  AS lat,
         s.google_maps_url,
         ST_Distance_Sphere(
           s.ubicacion,
           ST_GeomFromText(?)
         ) AS distancia
       FROM servicios s
       WHERE MBRContains(
         ST_GeomFromText(?),
         s.ubicacion
       )
       ORDER BY distancia ASC
       LIMIT 50`,
      [
        // Punto central para calcular distancia
        `POINT(${centerLng} ${centerLat})`,
        // Polígono del bounding box (anillo cerrado, coordenadas en orden lng lat)
        `POLYGON((${lng_min} ${lat_min}, ${lng_max} ${lat_min}, ${lng_max} ${lat_max}, ${lng_min} ${lat_max}, ${lng_min} ${lat_min}))`,
      ]
    );

    // ── 3. Query carteles activos dentro del bounding box ──────────────────
    const [carteles] = await db.query(
      `SELECT
         c.id,
         c.usuario_id,
         c.mascota_id,
         c.tipo,
         c.descripcion,
         c.telefono_contacto,
         c.foto_url,
         ST_X(c.ubicacion)  AS lng,
         ST_Y(c.ubicacion)  AS lat,
         c.activo,
         c.created_at,
         u.nombre           AS publicador_nombre,
         ST_Distance_Sphere(
           c.ubicacion,
           ST_GeomFromText(?)
         ) AS distancia
       FROM carteles c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.activo = TRUE
         AND MBRContains(
           ST_GeomFromText(?),
           c.ubicacion
         )
       ORDER BY distancia ASC
       LIMIT 50`,
      [
        `POINT(${centerLng} ${centerLat})`,
        `POLYGON((${lng_min} ${lat_min}, ${lng_max} ${lat_min}, ${lng_max} ${lat_max}, ${lng_min} ${lat_max}, ${lng_min} ${lat_min}))`,
      ]
    );

    // ── 4. Query amigos con ubicación compartida dentro del bounding box ───
    //
    // Solo se incluyen usuarios que:
    //   a) Tienen una amistad ACEPTADA con el usuario autenticado (en cualquier
    //      dirección: usuario_a_id o usuario_b_id puede ser el autenticado).
    //   b) Tienen compartir_ubicacion = TRUE en ubicaciones_usuarios.
    //   c) Su ubicación cae dentro del bounding box.
    const [amigos] = await db.query(
      `SELECT
         uu.usuario_id,
         u.nombre,
         u.foto_perfil_url,
         m.nombre           AS mascota_nombre,
         ST_X(uu.ubicacion) AS lng,
         ST_Y(uu.ubicacion) AS lat,
         ST_Distance_Sphere(
           uu.ubicacion,
           ST_GeomFromText(?)
         ) AS distancia
       FROM ubicaciones_usuarios uu
       JOIN usuarios u ON u.id = uu.usuario_id
       LEFT JOIN mascotas m ON m.usuario_id = u.id AND m.principal = TRUE
       JOIN amistades a ON (
         (a.usuario_a_id = ? AND a.usuario_b_id = uu.usuario_id)
         OR
         (a.usuario_b_id = ? AND a.usuario_a_id = uu.usuario_id)
       )
       WHERE uu.compartir_ubicacion = TRUE
         AND a.estado = 'aceptada'
         AND MBRContains(
           ST_GeomFromText(?),
           uu.ubicacion
         )
       ORDER BY distancia ASC
       LIMIT 50`,
      [
        `POINT(${centerLng} ${centerLat})`,
        usuarioId,
        usuarioId,
        `POLYGON((${lng_min} ${lat_min}, ${lng_max} ${lat_min}, ${lng_max} ${lat_max}, ${lng_min} ${lat_max}, ${lng_min} ${lat_min}))`,
      ]
    );

    // ── 5. Combinar, ordenar por distancia y limitar a 50 markers totales ──
    const todosLosMarkers = [
      ...servicios.map((s) => ({ ...s, _tipo: 'servicio' })),
      ...carteles.map((c) => ({ ...c, _tipo: 'cartel' })),
      ...amigos.map((a) => ({ ...a, _tipo: 'amigo' })),
    ];

    todosLosMarkers.sort((a, b) => (a.distancia || 0) - (b.distancia || 0));

    const top50 = todosLosMarkers.slice(0, 50);

    // Separar de vuelta en sus categorías (manteniendo el orden de prioridad)
    const serviciosFinal = top50
      .filter((m) => m._tipo === 'servicio')
      .map(({ _tipo, distancia, ...rest }) => ({ ...rest, distancia }));

    const cartelesFinal = top50
      .filter((m) => m._tipo === 'cartel')
      .map(({ _tipo, distancia, ...rest }) => ({
        ...rest,
        distancia,
        publicador: { nombre: rest.publicador_nombre },
      }));

    const amigosFinal = top50
      .filter((m) => m._tipo === 'amigo')
      .map(({ _tipo, distancia, ...rest }) => ({
        ...rest,
        distancia,
        // online: se puede determinar comparando updated_at con el tiempo actual
        // (si updated_at < 5 min → online). Por ahora se omite para no acoplar
        // lógica de sesión aquí; el endpoint GET /amigos lo calcula.
        online: false,
      }));

    // ── 6. Responder ────────────────────────────────────────────────────────
    return res.json({
      servicios: serviciosFinal,
      carteles: cartelesFinal,
      amigos: amigosFinal,
    });
  } catch (err) {
    console.error('[GET /comunidad/mapa] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/comunidad/servicios
// ---------------------------------------------------------------------------

/**
 * Devuelve hasta 50 servicios para mascotas dentro del bounding box indicado,
 * ordenados por distancia al centro del bbox. Permite filtrar por tipo.
 *
 * Query params (requeridos):
 *   lat_min  {number}  — latitud mínima (sur)
 *   lat_max  {number}  — latitud máxima (norte)
 *   lng_min  {number}  — longitud mínima (oeste)
 *   lng_max  {number}  — longitud máxima (este)
 *
 * Query params (opcionales):
 *   tipo     {string}  — filtro por tipo: 'veterinaria' | 'paseador' | 'petshop' | 'peluqueria'
 *
 * Respuesta 200:
 *   [
 *     {
 *       id:             string,
 *       tipo:           string,
 *       nombre:         string,
 *       direccion:      string,
 *       telefono:       string | null,
 *       descripcion:    string | null,
 *       lat:            number,
 *       lng:            number,
 *       google_maps_url: string | null,
 *       verified:       boolean,
 *       distancia:      number   // metros
 *     }
 *   ]
 *
 * Respuesta 400: bounding box inválido o tipo no reconocido
 */
router.get('/servicios', async (req, res) => {
  // ── 1. Parsear y validar bounding box ──────────────────────────────────────
  const lat_min = parseCoord(req.query.lat_min);
  const lat_max = parseCoord(req.query.lat_max);
  const lng_min = parseCoord(req.query.lng_min);
  const lng_max = parseCoord(req.query.lng_max);

  const validation = validateBoundingBox({ lat_min, lat_max, lng_min, lng_max });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // ── 2. Validar tipo (opcional) ─────────────────────────────────────────────
  const tiposValidos = ['veterinaria', 'paseador', 'petshop', 'peluqueria'];
  const tipo = req.query.tipo || null;

  if (tipo !== null && !tiposValidos.includes(tipo)) {
    return res.status(400).json({
      error: `El parámetro tipo debe ser uno de: ${tiposValidos.join(', ')}.`,
    });
  }

  // Centro del bounding box — usado para calcular distancias y ordenar
  const centerLat = (lat_min + lat_max) / 2;
  const centerLng = (lng_min + lng_max) / 2;

  const db = req.db || req.app.locals.db;

  try {
    // ── 3. Construir query con filtro opcional de tipo ─────────────────────
    //
    // MBRContains(poligono, punto) devuelve TRUE si el punto está dentro del
    // rectángulo mínimo delimitador del polígono.
    //
    // ST_Distance_Sphere devuelve la distancia en metros entre dos puntos.
    let query;
    let params;

    const bboxPolygon = `POLYGON((${lng_min} ${lat_min}, ${lng_max} ${lat_min}, ${lng_max} ${lat_max}, ${lng_min} ${lat_max}, ${lng_min} ${lat_min}))`;
    const centerPoint = `POINT(${centerLng} ${centerLat})`;

    if (tipo) {
      query = `
        SELECT
          s.id,
          s.tipo,
          s.nombre,
          s.direccion,
          s.telefono,
          s.descripcion,
          ST_Y(s.ubicacion) AS lat,
          ST_X(s.ubicacion) AS lng,
          s.google_maps_url,
          s.verified,
          ST_Distance_Sphere(
            s.ubicacion,
            ST_GeomFromText(?)
          ) AS distancia
        FROM servicios s
        WHERE MBRContains(
          ST_GeomFromText(?),
          s.ubicacion
        )
          AND s.tipo = ?
        ORDER BY distancia ASC
        LIMIT 50`;

      params = [centerPoint, bboxPolygon, tipo];
    } else {
      query = `
        SELECT
          s.id,
          s.tipo,
          s.nombre,
          s.direccion,
          s.telefono,
          s.descripcion,
          ST_Y(s.ubicacion) AS lat,
          ST_X(s.ubicacion) AS lng,
          s.google_maps_url,
          s.verified,
          ST_Distance_Sphere(
            s.ubicacion,
            ST_GeomFromText(?)
          ) AS distancia
        FROM servicios s
        WHERE MBRContains(
          ST_GeomFromText(?),
          s.ubicacion
        )
        ORDER BY distancia ASC
        LIMIT 50`;

      params = [centerPoint, bboxPolygon];
    }

    const [servicios] = await db.query(query, params);

    // ── 4. Convertir verified de 1/0 a boolean ────────────────────────────
    const serviciosFormateados = servicios.map((s) => ({
      ...s,
      verified: Boolean(s.verified),
    }));

    // ── 5. Responder ──────────────────────────────────────────────────────
    return res.json(serviciosFormateados);
  } catch (err) {
    console.error('[GET /comunidad/servicios] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/carteles
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo cartel comunitario geoposicionado.
 *
 * Body (multipart/form-data):
 *   tipo              {string}  requerido — 'perdida' | 'encontrada' | 'adopcion' | 'aviso_general'
 *   telefono_contacto {string}  requerido — formato /^\+?[\d\s\-()]{7,20}$/
 *   lat               {number}  requerido — latitud válida
 *   lng               {number}  requerido — longitud válida
 *   mascota_id        {string}  opcional
 *   descripcion       {string}  opcional — máx 300 caracteres
 *   foto              {file}    opcional — JPG/PNG/GIF, máx 5MB
 *
 * Respuesta 201: cartel creado
 * Respuesta 400: errores de validación
 */
router.post('/carteles', upload.single('foto'), async (req, res) => {
  // ── 1. Extraer campos del body ────────────────────────────────────────────
  const {
    tipo,
    telefono_contacto,
    lat,
    lng,
    mascota_id,
    descripcion,
  } = req.body;

  // ── 2. Validar campos requeridos y formatos ───────────────────────────────
  const errores = [];

  // tipo: debe ser uno de los valores permitidos
  const tiposValidos = ['perdida', 'encontrada', 'adopcion', 'aviso_general'];
  if (!tipo || !tiposValidos.includes(tipo)) {
    errores.push({
      campo: 'tipo',
      mensaje: `El campo tipo es requerido y debe ser uno de: ${tiposValidos.join(', ')}.`,
    });
  }

  // telefono_contacto: requerido, formato válido
  const telefonoRegex = /^\+?[\d\s\-()\u002D]{7,20}$/;
  if (!telefono_contacto || telefono_contacto.trim() === '') {
    errores.push({ campo: 'telefono_contacto', mensaje: 'El teléfono de contacto es requerido.' });
  } else if (!telefonoRegex.test(telefono_contacto.trim())) {
    errores.push({ campo: 'telefono_contacto', mensaje: 'El formato del teléfono de contacto no es válido.' });
  }

  // lat: requerido, número válido
  const latNum = lat !== undefined && lat !== null && lat !== '' ? parseFloat(lat) : null;
  if (latNum === null || !isFinite(latNum)) {
    errores.push({ campo: 'lat', mensaje: 'El campo lat es requerido y debe ser un número válido.' });
  }

  // lng: requerido, número válido
  const lngNum = lng !== undefined && lng !== null && lng !== '' ? parseFloat(lng) : null;
  if (lngNum === null || !isFinite(lngNum)) {
    errores.push({ campo: 'lng', mensaje: 'El campo lng es requerido y debe ser un número válido.' });
  }

  // descripcion: opcional, máx 300 caracteres
  if (descripcion && descripcion.length > 300) {
    errores.push({ campo: 'descripcion', mensaje: 'La descripción no puede superar los 300 caracteres.' });
  }

  if (errores.length > 0) {
    return res.status(400).json({ errores });
  }

  // ── 3. Determinar foto_url si se subió un archivo ─────────────────────────
  let foto_url = null;
  if (req.file) {
    // Ruta relativa al archivo guardado (normalizada con barras hacia adelante)
    foto_url = req.file.path.replace(/\\/g, '/');
  }

  // ── 4. Insertar en la base de datos ──────────────────────────────────────
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;

  try {
    const [result] = await db.query(
      `INSERT INTO carteles
         (usuario_id, mascota_id, tipo, descripcion, telefono_contacto, foto_url, ubicacion)
       VALUES
         (?, ?, ?, ?, ?, ?, ST_GeomFromText(?))`,
      [
        usuarioId,
        mascota_id || null,
        tipo,
        descripcion || null,
        telefono_contacto.trim(),
        foto_url,
        `POINT(${lngNum} ${latNum})`,
      ]
    );

    // ── 5. Recuperar el cartel recién creado ──────────────────────────────
    const insertId = result.insertId;

    // Si la tabla usa UUID como PK (DEFAULT UUID()), insertId puede ser 0.
    // En ese caso recuperamos por los campos únicos de la inserción.
    let cartelCreado;

    if (insertId) {
      const [rows] = await db.query(
        `SELECT
           id, usuario_id, mascota_id, tipo, descripcion,
           telefono_contacto, foto_url,
           ST_X(ubicacion) AS lng,
           ST_Y(ubicacion) AS lat,
           activo, created_at
         FROM carteles
         WHERE id = ?`,
        [insertId]
      );
      cartelCreado = rows[0];
    } else {
      // UUID como PK: buscar el registro más reciente del usuario con estos datos
      const [rows] = await db.query(
        `SELECT
           id, usuario_id, mascota_id, tipo, descripcion,
           telefono_contacto, foto_url,
           ST_X(ubicacion) AS lng,
           ST_Y(ubicacion) AS lat,
           activo, created_at
         FROM carteles
         WHERE usuario_id = ?
           AND tipo = ?
           AND telefono_contacto = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [usuarioId, tipo, telefono_contacto.trim()]
      );
      cartelCreado = rows[0];
    }

    // ── 6. Responder 201 con el cartel creado ─────────────────────────────
    return res.status(201).json(cartelCreado);
  } catch (err) {
    console.error('[POST /carteles] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/carteles/:id
// ---------------------------------------------------------------------------

/**
 * Elimina (soft delete) un cartel propio del usuario autenticado.
 *
 * Params:
 *   id  {string}  — UUID del cartel a eliminar
 *
 * Respuesta 200: { mensaje: 'Cartel eliminado correctamente' }
 * Respuesta 403: { error: 'No tenés permiso para eliminar este cartel' }
 * Respuesta 404: { error: 'Cartel no encontrado' }
 */
router.delete('/carteles/:id', async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;
  const db = req.db || req.app.locals.db;

  try {
    // ── 1. Buscar el cartel por id ─────────────────────────────────────────
    const [rows] = await db.query(
      'SELECT usuario_id FROM carteles WHERE id = ?',
      [id]
    );

    const cartel = rows[0];

    // ── 2. Si no existe → 404 ─────────────────────────────────────────────
    if (!cartel) {
      return res.status(404).json({ error: 'Cartel no encontrado' });
    }

    // ── 3. Si no pertenece al usuario autenticado → 403 ───────────────────
    if (cartel.usuario_id !== usuarioId) {
      return res.status(403).json({ error: 'No tenés permiso para eliminar este cartel' });
    }

    // ── 4. Soft delete: marcar activo = FALSE ─────────────────────────────
    await db.query(
      'UPDATE carteles SET activo = FALSE WHERE id = ?',
      [id]
    );

    // ── 5. Responder 200 ──────────────────────────────────────────────────
    return res.json({ mensaje: 'Cartel eliminado correctamente' });
  } catch (err) {
    console.error('[DELETE /carteles/:id] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// Manejo de errores de multer (tamaño excedido, tipo de archivo inválido)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        errores: [{ campo: 'foto', mensaje: 'El archivo no puede superar los 5MB.' }],
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        errores: [{ campo: 'foto', mensaje: 'Solo se permiten imágenes en formato JPG, PNG o GIF.' }],
      });
    }
    return res.status(400).json({ errores: [{ campo: 'foto', mensaje: err.message }] });
  }
  next(err);
});

module.exports = router;
