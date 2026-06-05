import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../config/database.js';

export async function loginAsync(email, password) {
  const query = `
    SELECT Id_User, Nombre, Contrasena
    FROM [User]
    WHERE Mail = @Email AND Estado = 1
  `;

  const pool = await getPool();
  const result = await pool.request()
    .input('Email', sql.NVarChar, email)
    .query(query);

  if (result.recordset.length === 0) {
    return null;
  }

  const user = result.recordset[0];
  const userId = user.Id_User;
  const nombre = user.Nombre;
  const storedHash = user.Contrasena;

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
