/**
 * imagenStorage.js — Subida de imágenes a Supabase Storage (bucket "public-images",
 * y "consultas-privadas" para lo clínico, que se lee con URLs firmadas)
 *
 * Cada archivo va a <id de Supabase Auth>/<uso>/<nombre>: las políticas de
 * sección 063 de SUPABASE_PEGAR_TODO.sql sólo dejan subir y borrar dentro de la carpeta propia, y el
 * bucket limita tamaño y tipo del lado del servidor.
 *
 * El tipo de archivo sale de sus BYTES (utils/tipoDeArchivo.tipoReal), no de
 * la extensión, del data URI ni del mime que da el picker: esos los decide
 * quien sube (informe #71). Lo que no sea una imagen —o un video, en
 * "resenas"— no se sube. El nombre es al azar (nombreAlAzar, #135-#137).
 *
 * Borrar archivos (informe de seguridad #70) pasa por DOS caminos, a propósito:
 * los `borrar*` de acá los llama la app al borrar la fila dueña (el archivo se
 * va en el momento), y los triggers de MIGRACION_068 anotan en
 * `archivos_por_borrar` todo lo que quede sin uso igual —cascadas, borrados
 * hechos desde el SQL— para que `supabase/scripts/limpiar-storage.mjs` lo
 * limpie después. Borrar dos veces el mismo archivo no es un error.
 */

import { supabase, SUPABASE_ORIGIN } from '../lib/supabase';
import { nombreAlAzar, tipoReal } from '../utils/tipoDeArchivo';

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

// Los mismos tipos que acepta cada bucket (allowed_mime_types en el SQL base
// y la 064): un GIF en "consultas-privadas" se rechaza acá y no en el servidor.
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const TIPOS_POR_BUCKET = {
  'public-images': [...IMAGENES, 'image/gif'],
  'consultas-privadas': IMAGENES,
  resenas: [...IMAGENES, 'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'],
};

/**
 * Lee el archivo y decide qué es por sus bytes. Devuelve { buffer, mime, ext }.
 * Tira Error('archivo_invalido') si no es de un tipo que el bucket acepte,
 * además de los errores de leerArchivo.
 */
async function leerYReconocer(uri, bucket) {
  const buffer = await leerArchivo(uri, bucket);
  const tipo = tipoReal(buffer);
  if (!tipo || !(TIPOS_POR_BUCKET[bucket] ?? IMAGENES).includes(tipo.mime)) {
    throw new Error('archivo_invalido');
  }
  return { buffer, ...tipo };
}

/** Sube a <carpeta propia>/<uso>/<nombre al azar> y devuelve la ruta. */
async function subir(uri, uso, bucket) {
  const { buffer, mime, ext } = await leerYReconocer(uri, bucket);
  const path = `${await carpetaPropia(uso)}/${nombreAlAzar(ext)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: mime });
  if (error) throw error;
  return { path, mime };
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

/**
 * Sube una imagen (uri local o data URI) a Supabase Storage y devuelve su
 * URL pública. `carpeta` agrupa el uso (ej: 'carteles', 'perfiles').
 */
export async function subirImagenPublica(uri, carpeta) {
  const { path } = await subir(uri, carpeta, BUCKET);
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
  const { path } = await subir(uri, carpeta, bucket);
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

/**
 * Como subirImagenPublica pero acepta también videos y otro bucket (las
 * reseñas usan "resenas", que admite video/*). Si es imagen o video lo dicen
 * los bytes del archivo.
 */
export async function subirArchivoPublico(uri, carpeta, { bucket = BUCKET } = {}) {
  const { path, mime } = await subir(uri, carpeta, bucket);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, tipo: mime.startsWith('video/') ? 'video' : 'imagen' };
}
