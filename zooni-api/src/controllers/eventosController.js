import pool from '../config/pgPool.js';
import { getUserId } from '../middleware/auth.js';

/**
 * GET /api/v1/eventos
 * Devuelve eventos activos y vigentes, opcionalmente filtrados por ciudad.
 */
export async function getEventos(req, res) {
  try {
    const userId = getUserId(req);
    const ciudad = req.query.ciudad?.trim() || null;
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const conditions = [
      'e.activo = TRUE',
      "e.fecha_hora >= NOW() - INTERVAL '1 hour'",
    ];
    const params = [userId];

    if (ciudad) {
      params.push(ciudad);
      conditions.push(`LOWER(e.ciudad) LIKE LOWER('%' || $${params.length} || '%')`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM eventos e
       WHERE ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total ?? 0;

    params.push(limit, offset);
    const limitIdx  = params.length - 1;
    const offsetIdx = params.length;

    const result = await pool.query(
      `SELECT
         e.id,
         e.titulo,
         e.descripcion,
         e.imagen_url,
         e.fecha_hora,
         e.ubicacion_nombre,
         e.lat,
         e.lng,
         e.ciudad,
         e.categoria_tag,
         ov.nombre AS organizador_nombre,
         ov.es_oficial AS organizador_es_oficial,
         EXISTS (
           SELECT 1
           FROM eventos_calendario ec
           JOIN "Mascota" m ON ec.mascota_id = m."Id_Mascota"
           WHERE m."Id_User" = $1
             AND ec.titulo = e.titulo
             AND DATE(ec.fecha_hora) = DATE(e.fecha_hora)
         ) AS ya_en_calendario
       FROM eventos e
       JOIN organizadores_verificados ov ON e.organizador_id = ov.id
       WHERE ${whereClause}
       ORDER BY e.fecha_hora ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    res.json({
      eventos: result.rows.map(mapEventoRow),
      total,
      page,
      hay_mas: offset + result.rows.length < total,
    });
  } catch (err) {
    console.error('Error en getEventos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function mapEventoRow(row) {
  return {
    id:                   row.id,
    titulo:               row.titulo,
    descripcion:          row.descripcion,
    imagen_url:           row.imagen_url,
    fecha_hora:           row.fecha_hora,
    ubicacion_nombre:     row.ubicacion_nombre,
    lat:                  row.lat != null ? parseFloat(row.lat) : null,
    lng:                  row.lng != null ? parseFloat(row.lng) : null,
    ciudad:               row.ciudad,
    categoria_tag:        row.categoria_tag,
    organizador_nombre:   row.organizador_nombre,
    organizador_es_oficial: row.organizador_es_oficial,
    ya_en_calendario:     row.ya_en_calendario,
  };
}

const TIPOS_VALIDOS = new Set([
  'Vacuna',
  'Turno Veterinario',
  'Desparasitación',
  'Peluquería',
  'Paseo',
  'Medicación',
  'Control',
  'Otro',
  'Evento',
]);

/**
 * POST /api/v1/mascotas/:petId/eventos
 * Agrega un evento al calendario de cuidados de una mascota.
 */
export async function createEventoCalendario(req, res) {
  try {
    const userId = getUserId(req);
    const petId  = parseInt(req.params.petId, 10);
    const { titulo, descripcion, fecha_hora, tipo } = req.body;

    if (!titulo?.trim()) {
      return res.status(400).json({ error: 'El título del evento es requerido' });
    }

    if (!fecha_hora) {
      return res.status(400).json({ error: 'La fecha y hora son requeridas' });
    }

    const fechaEvento = new Date(fecha_hora);
    if (Number.isNaN(fechaEvento.getTime())) {
      return res.status(400).json({ error: 'La fecha y hora son requeridas' });
    }

    const tipoEvento = tipo || 'Otro';
    if (!TIPOS_VALIDOS.has(tipoEvento)) {
      return res.status(400).json({ error: 'Tipo de evento no válido' });
    }

    const mascotaResult = await pool.query(
      `SELECT "Id_Mascota" AS id FROM "Mascota"
       WHERE "Id_Mascota" = $1 AND "Id_User" = $2`,
      [petId, userId],
    );

    if (mascotaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    const insertResult = await pool.query(
      `INSERT INTO eventos_calendario (mascota_id, titulo, descripcion, fecha_hora, tipo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, descripcion, fecha_hora, tipo, creado_en`,
      [petId, titulo.trim(), descripcion ?? null, fechaEvento, tipoEvento],
    );

    const evento = insertResult.rows[0];

    res.status(201).json({
      mensaje: 'Evento registrado correctamente',
      evento: {
        id:          evento.id,
        titulo:      evento.titulo,
        descripcion: evento.descripcion,
        fecha_hora:  evento.fecha_hora,
        tipo:        evento.tipo,
        creado_en:   evento.creado_en,
      },
    });
  } catch (err) {
    console.error('Error en createEventoCalendario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
