import { getPool, sql } from '../config/database.js';

// ─── Mapa ─────────────────────────────────────────────────────────────────────

export async function getMapaData({ lat_min, lat_max, lng_min, lng_max }) {
  const pool = await getPool();

  const [serviciosRes, cartelesRes] = await Promise.all([
    pool.request()
      .input('lat_min', sql.Float, parseFloat(lat_min))
      .input('lat_max', sql.Float, parseFloat(lat_max))
      .input('lng_min', sql.Float, parseFloat(lng_min))
      .input('lng_max', sql.Float, parseFloat(lng_max))
      .query(`
        SELECT TOP 50
          Id_Servicio AS id, Tipo AS tipo, Nombre AS nombre,
          Direccion AS direccion, Telefono AS telefono,
          Descripcion AS descripcion, Lat AS lat, Lng AS lng,
          GoogleMapsUrl AS google_maps_url
        FROM Servicio
        WHERE Lat BETWEEN @lat_min AND @lat_max
          AND Lng BETWEEN @lng_min AND @lng_max
      `),
    pool.request()
      .input('lat_min', sql.Float, parseFloat(lat_min))
      .input('lat_max', sql.Float, parseFloat(lat_max))
      .input('lng_min', sql.Float, parseFloat(lng_min))
      .input('lng_max', sql.Float, parseFloat(lng_max))
      .query(`
        SELECT TOP 50
          c.Id_Cartel AS id, c.Id_User AS usuario_id, c.Tipo AS tipo,
          c.Descripcion AS descripcion, c.TelefonoContacto AS telefono_contacto,
          c.FotoUrl AS foto_url, c.Lat AS lat, c.Lng AS lng,
          c.CreatedAt AS created_at,
          u.Nombre + ' ' + u.Apellido AS publicado_por
        FROM Cartel c
        JOIN [User] u ON u.Id_User = c.Id_User
        WHERE c.Activo = 1
          AND c.Lat BETWEEN @lat_min AND @lat_max
          AND c.Lng BETWEEN @lng_min AND @lng_max
      `),
  ]);

  return {
    servicios: serviciosRes.recordset,
    carteles: cartelesRes.recordset,
    amigos: [],
  };
}

// ─── Carteles ────────────────────────────────────────────────────────────────

export async function crearCartel(userId, { tipo, descripcion, telefono_contacto, lat, lng }) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .input('tipo', sql.NVarChar(20), tipo)
    .input('desc', sql.NVarChar(500), descripcion || null)
    .input('tel', sql.NVarChar(30), telefono_contacto)
    .input('lat', sql.Float, parseFloat(lat))
    .input('lng', sql.Float, parseFloat(lng))
    .query(`
      INSERT INTO Cartel (Id_User, Tipo, Descripcion, TelefonoContacto, Lat, Lng, Activo, CreatedAt)
      OUTPUT INSERTED.Id_Cartel AS id, INSERTED.Tipo AS tipo,
             INSERTED.Descripcion AS descripcion,
             INSERTED.TelefonoContacto AS telefono_contacto,
             INSERTED.Lat AS lat, INSERTED.Lng AS lng,
             INSERTED.CreatedAt AS created_at
      VALUES (@userId, @tipo, @desc, @tel, @lat, @lng, 1, SYSUTCDATETIME())
    `);
  return result.recordset[0];
}

export async function eliminarCartel(userId, cartelId) {
  const pool = await getPool();

  // Verificar dueño
  const check = await pool.request()
    .input('id', sql.Int, cartelId)
    .query('SELECT Id_User FROM Cartel WHERE Id_Cartel = @id AND Activo = 1');

  if (!check.recordset.length) return { notFound: true };
  if (check.recordset[0].Id_User !== userId) return { forbidden: true };

  await pool.request()
    .input('id', sql.Int, cartelId)
    .query('UPDATE Cartel SET Activo = 0 WHERE Id_Cartel = @id');

  return { ok: true };
}

// ─── Amigos ──────────────────────────────────────────────────────────────────

export async function getAmigos(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT u.Id_User AS usuario_id,
             u.Nombre + ' ' + u.Apellido AS nombre,
             u.FotoPerfil AS foto_perfil_url
      FROM Amistad a
      JOIN [User] u ON u.Id_User = CASE WHEN a.Id_User_A = @userId THEN a.Id_User_B ELSE a.Id_User_A END
      WHERE (a.Id_User_A = @userId OR a.Id_User_B = @userId)
        AND a.Estado = 'aceptada'
    `);
  return result.recordset;
}

export async function getSolicitudes(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT a.Id_Amistad AS id,
             u.Id_User AS usuario_id,
             u.Nombre + ' ' + u.Apellido AS nombre,
             u.FotoPerfil AS foto_perfil_url,
             a.CreatedAt AS created_at
      FROM Amistad a
      JOIN [User] u ON u.Id_User = a.Id_User_A
      WHERE a.Id_User_B = @userId AND a.Estado = 'pendiente'
    `);
  return result.recordset;
}

export async function enviarSolicitud(userId, destinoId) {
  const pool = await getPool();

  // Verificar si ya existe
  const check = await pool.request()
    .input('a', sql.Int, userId)
    .input('b', sql.Int, destinoId)
    .query(`
      SELECT 1 FROM Amistad
      WHERE (Id_User_A = @a AND Id_User_B = @b)
         OR (Id_User_A = @b AND Id_User_B = @a)
    `);

  if (check.recordset.length) return { conflict: true };

  await pool.request()
    .input('a', sql.Int, userId)
    .input('b', sql.Int, destinoId)
    .query(`
      INSERT INTO Amistad (Id_User_A, Id_User_B, Estado, CreatedAt, UpdatedAt)
      VALUES (@a, @b, 'pendiente', SYSUTCDATETIME(), SYSUTCDATETIME())
    `);

  return { ok: true };
}

export async function responderSolicitud(userId, solicitudId, accion) {
  const pool = await getPool();
  const estado = accion === 'aceptar' ? 'aceptada' : 'rechazada';

  const result = await pool.request()
    .input('id', sql.Int, solicitudId)
    .input('userId', sql.Int, userId)
    .input('estado', sql.NVarChar(15), estado)
    .query(`
      UPDATE Amistad SET Estado = @estado, UpdatedAt = SYSUTCDATETIME()
      WHERE Id_Amistad = @id AND Id_User_B = @userId
    `);

  return result.rowsAffected[0] > 0;
}

// ─── Ubicación ───────────────────────────────────────────────────────────────

export async function actualizarUbicacion(userId, lat, lng) {
  const pool = await getPool();
  await pool.request()
    .input('userId', sql.Int, userId)
    .input('lat', sql.Float, lat)
    .input('lng', sql.Float, lng)
    .query(`
      MERGE UbicacionUsuario AS target
      USING (SELECT @userId AS Id_User) AS src ON target.Id_User = src.Id_User
      WHEN MATCHED THEN
        UPDATE SET Lat = @lat, Lng = @lng, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (Id_User, Lat, Lng, UpdatedAt, CompartirUbicacion)
        VALUES (@userId, @lat, @lng, SYSUTCDATETIME(), 1);
    `);
}

// ─── Buscar usuarios ─────────────────────────────────────────────────────────

export async function buscarUsuarios(userId, q) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .input('q', sql.NVarChar(100), `%${q}%`)
    .query(`
      SELECT DISTINCT
        u.Id_User AS usuario_id,
        u.Nombre + ' ' + u.Apellido AS nombre,
        u.FotoPerfil AS foto_perfil_url,
        CASE WHEN a.Id_Amistad IS NOT NULL THEN 1 ELSE 0 END AS es_amigo
      FROM [User] u
      LEFT JOIN Amistad a ON (
        (a.Id_User_A = @userId AND a.Id_User_B = u.Id_User)
        OR (a.Id_User_A = u.Id_User AND a.Id_User_B = @userId)
      ) AND a.Estado = 'aceptada'
      WHERE u.Id_User <> @userId
        AND (u.Nombre LIKE @q OR u.Apellido LIKE @q)
      ORDER BY nombre
    `);
  return result.recordset;
}
