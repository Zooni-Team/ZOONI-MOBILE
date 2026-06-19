import { getPool, sql } from '../config/database.js';

const TIPOS_VALIDOS = [
  'Vacuna', 'Turno Veterinario', 'Desparasitación',
  'Peluquería', 'Paseo', 'Medicación', 'Control', 'Otro',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifica que la mascota exista y pertenezca al usuario.
 * Lanza { status, message } si no es válido.
 */
async function verificarMascota(pool, petId, userId) {
  const result = await pool
    .request()
    .input('MascotaId', sql.Int, petId)
    .input('UserId', sql.Int, userId)
    .query(
      `SELECT Id_Mascota FROM Mascota
       WHERE Id_Mascota = @MascotaId AND Id_User = @UserId`,
    );

  if (result.recordset.length === 0) {
    throw { status: 404, message: 'Mascota no encontrada' };
  }
}

/**
 * Verifica que el evento exista y pertenezca a esa mascota del usuario.
 */
async function verificarEvento(pool, eventoId, petId, userId) {
  const result = await pool
    .request()
    .input('EventoId', sql.Int, eventoId)
    .input('MascotaId', sql.Int, petId)
    .input('UserId', sql.Int, userId)
    .query(
      `SELECT ec.Id
       FROM Eventos_Calendario ec
       INNER JOIN Mascota m ON m.Id_Mascota = ec.Mascota_Id
       WHERE ec.Id = @EventoId
         AND ec.Mascota_Id = @MascotaId
         AND m.Id_User = @UserId`,
    );

  if (result.recordset.length === 0) {
    throw { status: 404, message: 'Evento no encontrado' };
  }
}

/** Mapea una fila de DB al DTO de respuesta. */
const mapEvento = (row) => ({
  id: row.Id,
  mascota_id: row.Mascota_Id,
  titulo: row.Titulo,
  descripcion: row.Descripcion ?? null,
  fecha_hora: row.Fecha_Hora,
  tipo: row.Tipo,
  creado_en: row.Creado_En,
  actualizado_en: row.Actualizado_En,
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getEventosAsync(petId, userId) {
  const pool = await getPool();
  await verificarMascota(pool, petId, userId);

  const result = await pool
    .request()
    .input('MascotaId', sql.Int, petId)
    .query(
      `SELECT Id, Mascota_Id, Titulo, Descripcion, Fecha_Hora, Tipo, Creado_En, Actualizado_En
       FROM Eventos_Calendario
       WHERE Mascota_Id = @MascotaId
       ORDER BY Fecha_Hora ASC`,
    );

  return result.recordset.map(mapEvento);
}

export async function createEventoAsync(petId, userId, body) {
  const { titulo, descripcion, fecha_hora, tipo } = body;

  if (!titulo || !titulo.trim()) {
    throw { status: 400, message: 'El título del evento es requerido' };
  }
  if (!fecha_hora) {
    throw { status: 400, message: 'La fecha y hora son requeridas' };
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw { status: 400, message: 'Tipo de evento no válido' };
  }

  const pool = await getPool();
  await verificarMascota(pool, petId, userId);

  const result = await pool
    .request()
    .input('MascotaId', sql.Int, petId)
    .input('Titulo', sql.NVarChar(150), titulo.trim())
    .input('Descripcion', sql.NVarChar(sql.MAX), descripcion ?? null)
    .input('FechaHora', sql.DateTime2, new Date(fecha_hora))
    .input('Tipo', sql.NVarChar(80), tipo)
    .query(
      `INSERT INTO Eventos_Calendario
         (Mascota_Id, Titulo, Descripcion, Fecha_Hora, Tipo)
       OUTPUT INSERTED.*
       VALUES (@MascotaId, @Titulo, @Descripcion, @FechaHora, @Tipo)`,
    );

  return mapEvento(result.recordset[0]);
}

export async function updateEventoAsync(petId, eventoId, userId, body) {
  const { titulo, descripcion, fecha_hora, tipo } = body;

  if (!titulo || !titulo.trim()) {
    throw { status: 400, message: 'El título del evento es requerido' };
  }
  if (!fecha_hora) {
    throw { status: 400, message: 'La fecha y hora son requeridas' };
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw { status: 400, message: 'Tipo de evento no válido' };
  }

  const pool = await getPool();
  await verificarEvento(pool, eventoId, petId, userId);

  const result = await pool
    .request()
    .input('EventoId', sql.Int, eventoId)
    .input('MascotaId', sql.Int, petId)
    .input('Titulo', sql.NVarChar(150), titulo.trim())
    .input('Descripcion', sql.NVarChar(sql.MAX), descripcion ?? null)
    .input('FechaHora', sql.DateTime2, new Date(fecha_hora))
    .input('Tipo', sql.NVarChar(80), tipo)
    .query(
      `UPDATE Eventos_Calendario
       SET Titulo = @Titulo,
           Descripcion = @Descripcion,
           Fecha_Hora = @FechaHora,
           Tipo = @Tipo,
           Actualizado_En = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE Id = @EventoId AND Mascota_Id = @MascotaId`,
    );

  if (result.recordset.length === 0) {
    throw { status: 404, message: 'Evento no encontrado' };
  }

  return mapEvento(result.recordset[0]);
}

export async function deleteEventoAsync(petId, eventoId, userId) {
  const pool = await getPool();
  await verificarEvento(pool, eventoId, petId, userId);

  await pool
    .request()
    .input('EventoId', sql.Int, eventoId)
    .input('MascotaId', sql.Int, petId)
    .query(
      `DELETE FROM Eventos_Calendario
       WHERE Id = @EventoId AND Mascota_Id = @MascotaId`,
    );
}
