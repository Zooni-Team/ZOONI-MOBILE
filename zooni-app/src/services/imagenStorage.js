/**
 * imagenStorage.js — Subida de imágenes a Supabase Storage (bucket "public-images",
 * y "consultas-privadas" para lo clínico, que se lee con URLs firmadas)
 *
 * Cada archivo va a <id de Supabase Auth>/<uso>/<nombre>: las políticas de
 * sección 063 de SUPABASE_PEGAR_TODO.sql sólo dejan subir y borrar dentro de la carpeta propia, y el
 * bucket limita tamaño y tipo del lado del servidor. Lo que el cliente declara
 * como contentType NO es la validación: es sólo una pista para Storage.
 *
 * En web, expo-image-picker devuelve un data URI ("data:image/png;base64,...")
 * en vez de una ruta con extensión, así que el tipo de imagen no se puede
 * sacar de la extensión del archivo — hay que leerlo del propio data URI.
 * En nativo (file://...) sí hay extensión, y no es un data URI.
 *
 * Borrar archivos (informe de seguridad #70) pasa por DOS caminos, a propósito:
 * los `borrar*` de acá los llama la app al borrar la fila dueña (el archivo se
 * va en el momento), y los triggers de MIGRACION_068 anotan en
 * `archivos_por_borrar` todo lo que quede sin uso igual —cascadas, borrados
 * hechos desde el SQL— para que `supabase/scripts/limpiar-storage.mjs` lo
 * limpie después. Borrar dos veces el mismo archivo no es un error.
 */

import { supabase, SUPABASE_ORIGIN } from '../lib/supabase';

const BUCKET = 'public-images';

// Los mismos topes que cada bucket fija del lado del servidor (SQL base, 064).
// Se controlan ANTES de subir para avisar enseguida, en vez de mandar 40 MB
// por datos móviles y recién ahí recibir el rechazo.
const MAX_BYTES_POR_BUCKET = {
  'public-images': 5 * 1024 * 1024,
  'consultas-privadas': 10 * 1024 * 1024,
  resenas: 50 * 1024 * 1024,
};

/**
 * Lee el archivo local (o data URI) a subir. Antes no se miraba `res.ok`:
 * una uri vencida subía la página de error como si fuera la imagen.
 * Tira Error('archivo_ilegible') o Error('archivo_muy_grande') (con .maxMb).
 */
async function leerArchivo(uri, bucket) {
  const res = await fetch(uri);
  // status 0: así contesta iOS un file:// local que se leyó bien.
  if (!res.ok && res.status !== 0) throw new Error('archivo_ilegible');
  const buffer = await res.arrayBuffer();
  const max = MAX_BYTES_POR_BUCKET[bucket];
  if (max && buffer.byteLength > max) {
    const e = new Error('archivo_muy_grande');
    e.maxMb = Math.round(max / (1024 * 1024));
    throw e;
  }
  return buffer;
}

/**
 * ¿Esta URL apunta a nuestro propio Storage? Para mostrar contenido que viene
 * de una fila de la base (foto de perfil, media de una reseña…) escrita por
 * CUALQUIER usuario, no por código propio: quien controla un link externo
 * puede registrar la IP de cada persona que lo vea (informe de seguridad
 * #42, #68, #138). `data:` también se acepta (imágenes ya en memoria).
 */
export function esUrlPropia(url) {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('data:')) return true;
  if (!SUPABASE_ORIGIN) return false;
  try {
    const u = new URL(url);
    return u.origin === SUPABASE_ORIGIN;
  } catch {
    return false;
  }
}

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
  const candidato = (uri.split('.').pop() || '').split('?')[0].toLowerCase();
  // Una uri sin extensión (content://…, blob:…) deja como "candidato" la uri
  // entera, con barras y dos puntos: eso rompería la key de Storage (informe
  // #125; subirArchivoPublico ya validaba esto por su lado).
  const ext = /^[a-z0-9]{1,5}$/.test(candidato) ? candidato : 'jpg';
  return { mime: `image/${ext === 'jpg' ? 'jpeg' : ext}`, ext };
}

/**
 * Sube una imagen (uri local o data URI) a Supabase Storage y devuelve su
 * URL pública. `carpeta` agrupa el uso (ej: 'carteles', 'perfiles').
 */
export async function subirImagenPublica(uri, carpeta) {
  const { mime, ext } = tipoDeImagen(uri);
  const path = `${await carpetaPropia(carpeta)}/${nombreArchivo(ext)}`;
  const arraybuffer = await leerArchivo(uri, BUCKET);

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
  const arraybuffer = await leerArchivo(uri, bucket);

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

/**
 * Borra un archivo de un bucket PRIVADO por su ruta. Nunca tira: borrar la
 * fila de la base ya pasó, y si el archivo no se pudo borrar sólo queda
 * ocupando espacio (y la 068 lo vuelve a anotar para el script de limpieza),
 * no es un error para quien llama.
 */
export async function borrarArchivoPrivado(path, bucket = BUCKET_CONSULTAS) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]).catch(() => {});
}

/**
 * Borra un archivo del bucket PÚBLICO a partir de la URL que devolvió
 * `subirImagenPublica`/`subirArchivoPublico`. Ignora silenciosamente
 * cualquier URL que no sea del Storage propio (no hay nada que borrar ahí) o
 * que no tenga la forma esperada. Nunca tira (ver `borrarArchivoPrivado`).
 */
export async function borrarImagenPublica(url) {
  if (!esUrlPropia(url) || typeof url !== 'string' || url.startsWith('data:')) return;
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url);
  if (!m) return;
  const [, bucket, pathCodificado] = m;
  await borrarArchivoPrivado(decodeURIComponent(pathCodificado), bucket);
}

/** Como `borrarImagenPublica`, pero para varias URLs. */
export async function borrarImagenesPublicas(urls) {
  await Promise.all((urls ?? []).map(borrarImagenPublica));
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
  const arraybuffer = await leerArchivo(uri, bucket);

  const { error } = await supabase.storage.from(bucket).upload(path, arraybuffer, { contentType: mime });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, tipo: mime.startsWith('video/') ? 'video' : 'imagen' };
}
