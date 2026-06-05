import { getPool, sql } from '../config/database.js';

export async function getHomeAsync(userId) {
  const query = `
    SELECT
      u.Id_User,
      u.Nombre        AS UserNombre,
      u.Apellido      AS UserApellido,
      u.FotoPerfil,
      m.Id_Mascota,
      m.Nombre        AS MascotaNombre,
      m.Especie,
      m.Raza,
      m.Foto          AS MascotaFoto,
      m.FechaNacimiento,
      (SELECT COUNT(*) FROM Notificacion n WHERE n.Id_User = u.Id_User AND n.Leido = 0) AS NotifCount
    FROM [User] u
    LEFT JOIN Mascota m ON m.Id_User = u.Id_User
      AND m.Id_Mascota = (
        SELECT TOP 1 Id_Mascota FROM Mascota
        WHERE Id_User = u.Id_User
        ORDER BY Id_Mascota ASC
      )
    WHERE u.Id_User = @UserId
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(query);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];

  const dto = {
    usuario: {
      id: row.Id_User,
      nombre: row.UserNombre || '',
      apellido: row.UserApellido || null,
      fotoPerfil: row.FotoPerfil || null,
    },
    notificacionesNoLeidas: row.NotifCount,
    mascotaActiva: null,
  };

  if (row.Id_Mascota) {
    const fechaNac = row.FechaNacimiento ? new Date(row.FechaNacimiento) : new Date();
    const today = new Date();
    const totalMonths = (today.getFullYear() - fechaNac.getFullYear()) * 12 + 
                        today.getMonth() - fechaNac.getMonth();

    dto.mascotaActiva = {
      id: row.Id_Mascota,
      nombre: row.MascotaNombre || '',
      especie: row.Especie || '',
      raza: row.Raza || '',
      fotoUrl: row.MascotaFoto || null,
      edadAnios: Math.floor(totalMonths / 12),
      edadMeses: totalMonths % 12,
    };
  }

  return dto;
}

const DEFAULT_CONFIG = [
  { seccion: 'comunidad', orden: 1, visible: true },
  { seccion: 'ficha_medica', orden: 2, visible: true },
  { seccion: 'mis_mascotas', orden: 3, visible: true },
];

export async function getConfigAsync(userId) {
  const query = 'SELECT ConfigJson FROM HomeConfig WHERE Id_User = @UserId';

  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(query);

  if (result.recordset.length === 0) {
    return { botones: DEFAULT_CONFIG };
  }

  const configJson = result.recordset[0].ConfigJson;
  const botones = JSON.parse(configJson);
  return { botones };
}

export async function saveConfigAsync(userId, config) {
  const configJson = JSON.stringify(config.botones);

  const query = `
    IF EXISTS (SELECT 1 FROM HomeConfig WHERE Id_User = @UserId)
      UPDATE HomeConfig SET ConfigJson = @Json, UpdatedAt = SYSUTCDATETIME() WHERE Id_User = @UserId
    ELSE
      INSERT INTO HomeConfig (Id_User, ConfigJson, UpdatedAt) VALUES (@UserId, @Json, SYSUTCDATETIME())
  `;

  const pool = await getPool();
  await pool.request()
    .input('UserId', sql.Int, userId)
    .input('Json', sql.NVarChar, configJson)
    .query(query);
}

export async function activarMascotaAsync(userId, mascotaId) {
  const query = `
    SELECT COUNT(1) AS Count
    FROM Mascota
    WHERE Id_Mascota = @MascotaId AND Id_User = @UserId
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('MascotaId', sql.Int, mascotaId)
    .input('UserId', sql.Int, userId)
    .query(query);

  return result.recordset[0].Count > 0;
}
