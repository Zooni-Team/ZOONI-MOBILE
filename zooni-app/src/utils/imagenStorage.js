/**
 * imagenStorage.js — Subida de imágenes a Supabase Storage (bucket "public-images",
 * y "consultas-privadas" para lo clínico, que se lee con URLs firmadas)
 *
 * Cada archivo va a <id de Supabase Auth>/<uso>/<nombre>: las políticas de
 * 063_storage.sql sólo dejan subir y borrar dentro de la carpeta propia, y el
 * bucket limita tamaño y tipo del lado del servidor. Lo que el cliente declara
 * como contentType NO es la validación: es sólo una pista para Storage.
 *
 * En web, expo-image-picker devuelve un data URI ("data:image/png;base64,...")
 * en vez de una ruta con extensión, así que el tipo de imagen no se puede
 * sacar de la extensión del archivo — hay que leerlo del propio data URI.
 * En nativo (file://...) sí hay extensión, y no es un data URI.
 */

import { supabase } from '../lib/supabase';

const BUCKET = 'public-images';

/** Carpeta propia en Storage: el id de Supabase Auth de la sesión. */
async function carpetaPropia(uso) {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error('sin_sesion');
  return `${uid}/${uso}`;
}

function nombreArchivo(ext) {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
}

function tipoDeImagen(uri) {
  const dataUri = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(uri);
  if (dataUri) {
    const mime = dataUri[1].toLowerCase();
    return { mime, ext: mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] };
  }
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  return { mime: `image/${ext === 'jpg' ? 'jpeg' : ext}`, ext };
}

/**
 * Sube una imagen (uri local o data URI) a Supabase Storage y devuelve su
 * URL pública. `carpeta` agrupa el uso (ej: 'carteles', 'perfiles').
 */
export async function subirImagenPublica(uri, carpeta) {
  const { mime, ext } = tipoDeImagen(uri);
  const path = `${await carpetaPropia(carpeta)}/${nombreArchivo(ext)}`;
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, arraybuffer, {
    contentType: mime,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Bucket privado de estudios y recetas de consultas veterinarias (064). */
export const BUCKET_CONSULTAS = 'consultas-privadas';

/**
 * Sube una imagen a un bucket PRIVADO y devuelve su RUTA (no una URL): en un
 * bucket privado no hay URL pública, se pide una firmada cada vez que se
 * muestra (urlsFirmadas). Misma carpeta propia y mismo control de tipo que
 * subirImagenPublica.
 */
export async function subirImagenPrivada(uri, carpeta, bucket = BUCKET_CONSULTAS) {
  const { mime, ext } = tipoDeImagen(uri);
  const path = `${await carpetaPropia(carpeta)}/${nombreArchivo(ext)}`;
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, arraybuffer, { contentType: mime });
  if (error) throw error;
  return path;
}

/** Una hora: alcanza para ver la pantalla; si vence, se pide otra al recargar. */
const VIGENCIA_URL_FIRMADA_S = 60 * 60;

/**
 * URLs firmadas para varias rutas de un bucket privado, en un solo pedido.
 * Devuelve { [ruta]: url }. Storage sólo firma lo que la sesión puede leer
 * (política zooni_privado_leer): una ruta ajena vuelve sin URL.
 */
export async function urlsFirmadas(rutas, bucket = BUCKET_CONSULTAS, segundos = VIGENCIA_URL_FIRMADA_S) {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!unicas.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unicas, segundos);
  if (error) throw error;
  const porRuta = {};
  for (const f of data ?? []) if (f.signedUrl && !f.error) porRuta[f.path] = f.signedUrl;
  return porRuta;
}

const EXT_VIDEO = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp' };

/** Tipo de una imagen O un video: del data URI, del mime que da el picker o de la extensión. */
function tipoDeArchivo(uri, mimeHint) {
  const dataUri = /^data:((?:image|video)\/[a-z0-9.+-]+);base64,/i.exec(uri);
  const mime = (dataUri?.[1] ?? mimeHint ?? '').toLowerCase();
  if (mime.startsWith('video/')) {
    const ext = Object.keys(EXT_VIDEO).find((k) => EXT_VIDEO[k] === mime) ?? mime.split('/')[1];
    return { mime, ext };
  }
  if (mime.startsWith('image/')) return { mime, ext: mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] };
  const ext = (uri.split('.').pop() || '').split('?')[0].toLowerCase();
  if (EXT_VIDEO[ext]) return { mime: EXT_VIDEO[ext], ext };
  return tipoDeImagen(uri);
}

/**
 * Como subirImagenPublica pero acepta también videos y otro bucket (las
 * reseñas usan "resenas", que admite video/*). `mimeHint` es el que da
 * expo-image-picker (asset.mimeType) cuando la uri no lo dice.
 */
export async function subirArchivoPublico(uri, carpeta, { bucket = BUCKET, mimeHint } = {}) {
  const tipo = tipoDeArchivo(uri, mimeHint);
  // Una uri sin extensión (content://…, blob:…) deja como "ext" la uri entera,
  // con barras y dos puntos: Storage rechaza esa key y ese contentType.
  const extOk = /^[a-z0-9]{1,5}$/.test(tipo.ext);
  const esVideo = tipo.mime.startsWith('video/');
  const ext = extOk ? tipo.ext : esVideo ? 'mp4' : 'jpg';
  const mime = extOk ? tipo.mime : esVideo ? 'video/mp4' : 'image/jpeg';
  const path = `${await carpetaPropia(carpeta)}/${nombreArchivo(ext)}`;
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, arraybuffer, { contentType: mime });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, tipo: mime.startsWith('video/') ? 'video' : 'imagen' };
}
