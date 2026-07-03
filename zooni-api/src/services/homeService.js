import pool from '../config/pgPool.js';

export async function getHomeAsync(userId) {
  const query = `
    SELECT
      u.id_user,
      u.nombre        AS user_nombre,
      u.apellido      AS user_apellido,
      u.foto_perfil,
      m.id_mascota,
      m.nombre        AS mascota_nombre,
      m.especie,
      m.raza,
      m.foto          AS mascota_foto,
      m.fecha_nacimiento,
      (SELECT COUNT(*) FROM notificacion n WHERE n.id_user = u.id_user AND n.leido = false) AS notif_count
    FROM "user" u
    LEFT JOIN LATERAL (
      SELECT * FROM mascota
      WHERE id_user = u.id_user
      ORDER BY id_mascota ASC
      LIMIT 1
    ) m ON true
    WHERE u.id_user = $1
  `;

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  const dto = {
    usuario: {
      id: row.id_user,
      nombre: row.user_nombre || '',
      apellido: row.user_apellido || null,
      fotoPerfil: row.foto_perfil || null,
    },
    notificacionesNoLeidas: parseInt(row.notif_count) || 0,
    mascotaActiva: null,
  };

  if (row.id_mascota) {
    const fechaNac = row.fecha_nacimiento ? new Date(row.fecha_nacimiento) : new Date();
    const today = new Date();
    const totalMonths =
      (today.getFullYear() - fechaNac.getFullYear()) * 12 +
      today.getMonth() - fechaNac.getMonth();

    dto.mascotaActiva = {
      id: row.id_mascota,
      nombre: row.mascota_nombre || '',
      especie: row.especie || '',
      raza: row.raza || '',
      fotoUrl: row.mascota_foto || null,
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
  const query = 'SELECT config_json FROM home_config WHERE id_user = $1';

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    return { botones: DEFAULT_CONFIG };
  }

  const botones = JSON.parse(result.rows[0].config_json);
  return { botones };
}

export async function saveConfigAsync(userId, config) {
  const configJson = JSON.stringify(config.botones);

  const query = `
    INSERT INTO home_config (id_user, config_json, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (id_user)
    DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = NOW()
  `;

  await pool.query(query, [userId, configJson]);
}

export async function activarMascotaAsync(userId, mascotaId) {
  const query = `
    SELECT COUNT(1) AS count
    FROM mascota
    WHERE id_mascota = $1 AND id_user = $2
  `;

  const result = await pool.query(query, [mascotaId, userId]);
  return parseInt(result.rows[0].count) > 0;
}
