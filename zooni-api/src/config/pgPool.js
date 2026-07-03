import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isSupabase = (process.env.PG_HOST || '').includes('supabase.co');

const pool = new pg.Pool({
  host:     process.env.PG_HOST     || process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || process.env.DB_PORT || '5432'),
  database: process.env.PG_DATABASE || process.env.DB_DATABASE || 'zooni',
  user:     process.env.PG_USER     || process.env.DB_USER,
  password: process.env.PG_PASSWORD || process.env.DB_PASSWORD,
  // SSL requerido por Supabase; se activa automáticamente si el host es de Supabase
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL' + (isSupabase ? ' (Supabase)' : ''));
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err.message);
});

export default pool;
