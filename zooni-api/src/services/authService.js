import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../config/pgPool.js';

export async function loginAsync(email, password) {
  const query = `
    SELECT id_user, nombre, contrasena
    FROM "user"
    WHERE mail = $1 AND estado = true
  `;

  const result = await pool.query(query, [email]);

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  const userId = user.id_user;
  const nombre = user.nombre;
  const storedHash = user.contrasena;

  // TODO: Reemplazar con bcrypt cuando las contraseñas estén hasheadas
  // const isValid = await bcrypt.compare(password, storedHash);
  const isValid = storedHash === password;

  if (!isValid) {
    return null;
  }

  return generateToken(userId, nombre);
}

export function generateToken(userId, nombre) {
  const payload = {
    sub: userId.toString(),
    name: nombre,
    jti: crypto.randomUUID(),
  };

  const options = {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
}
