/**
 * upload.js — Configuración de multer para subida de imágenes
 *
 * Almacenamiento local en /uploads/perfiles  y /uploads/publicaciones.
 * Límite: 10 MB por archivo.
 * Tipos permitidos: jpg, jpeg, png, gif, webp.
 *
 * Exporta:
 *   uploadFoto        → upload.single('foto')       para foto de perfil
 *   uploadImagen      → upload.single('imagen')     para publicaciones
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// __dirname equivalente en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Directorio raíz de uploads (zooni-api/uploads/)
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Crear subdirectorios si no existen
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(path.join(UPLOADS_ROOT, 'perfiles'));
ensureDir(path.join(UPLOADS_ROOT, 'publicaciones'));

// ── Tipos MIME permitidos ─────────────────────────────────────────────────────
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no válido. Solo JPG, PNG, GIF y WebP.'), false);
  }
}

// ── Storage: foto de perfil ───────────────────────────────────────────────────
const storagePerfiles = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOADS_ROOT, 'perfiles'));
  },
  filename(_req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `perfil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

// ── Storage: imágenes de publicaciones ───────────────────────────────────────
const storagePublicaciones = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOADS_ROOT, 'publicaciones'));
  },
  filename(_req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

// ── Instancias de multer ──────────────────────────────────────────────────────
const _uploadFoto = multer({
  storage:    storagePerfiles,
  limits:     { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
});

const _uploadImagen = multer({
  storage:    storagePublicaciones,
  limits:     { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
});

/** Middleware para un único campo "foto" (foto de perfil) */
export const uploadFoto   = _uploadFoto.single('foto');

/** Middleware para un único campo "imagen" (publicación) */
export const uploadImagen = _uploadImagen.single('imagen');

/**
 * Construye la URL pública del archivo subido.
 * Si la app está en producción y se usa CDN, reemplazar esta función.
 *
 * @param {Express.Request} req
 * @param {Express.Multer.File} file
 * @param {'perfiles'|'publicaciones'} subfolder
 * @returns {string}
 */
export function buildFileUrl(req, file, subfolder) {
  const host     = process.env.API_BASE_URL ?? `${req.protocol}://${req.get('host')}`;
  return `${host}/uploads/${subfolder}/${file.filename}`;
}
