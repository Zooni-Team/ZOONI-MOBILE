import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const useWindowsAuth = !process.env.DB_USER || process.env.DB_USER === '';

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'Zooni',
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Si hay usuario/contraseña, usar SQL Authentication
// Si no, usar Windows Authentication
if (useWindowsAuth) {
  config.authentication = {
    type: 'ntlm',
    options: {
      domain: '', // Dejar vacío para usar el dominio actual
    },
  };
  console.log('🔐 Usando Windows Authentication');
} else {
  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;
  console.log('🔐 Usando SQL Authentication');
}

let pool = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { sql };
