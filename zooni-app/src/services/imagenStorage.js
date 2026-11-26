import { supabase, SUPABASE_ORIGIN } from '../lib/supabase';
import { nombreAlAzar, tipoReal } from '../utils/tipoDeArchivo';

const BUCKET = 'public-images';

const MAX_BYTES_POR_BUCKET = {
  'public-images': 5 * 1024 * 1024,
  'consultas-privadas': 10 * 1024 * 1024,
  resenas: 50 * 1024 * 1024,
};

async function leerArchivo(uri, bucket) {
  const res = await fetch(uri);
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

const IMAGENES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const TIPOS_POR_BUCKET = {
  'public-images': [...IMAGENES, 'image/gif'],
  'consultas-privadas': IMAGENES,
  resenas: [...IMAGENES, 'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'],
};

async function leerYReconocer(uri, bucket) {
  const buffer = await leerArchivo(uri, bucket);
  const tipo = tipoReal(buffer);
  if (!tipo || !(TIPOS_POR_BUCKET[bucket] ?? IMAGENES).includes(tipo.mime)) {
    throw new Error('archivo_invalido');
  }
  return { buffer, ...tipo };
}

async function subir(uri, uso, bucket) {
  const { buffer, mime, ext } = await leerYReconocer(uri, bucket);
  const path = `${await carpetaPropia(uso)}/${nombreAlAzar(ext)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: mime });
  if (error) throw error;
  return { path, mime };
}

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

async function carpetaPropia(uso) {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error('sin_sesion');
  return `${uid}/${uso}`;
}

export async function subirImagenPublica(uri, carpeta) {
  const { path } = await subir(uri, carpeta, BUCKET);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const BUCKET_CONSULTAS = 'consultas-privadas';

export async function subirImagenPrivada(uri, carpeta, bucket = BUCKET_CONSULTAS) {
  const { path } = await subir(uri, carpeta, bucket);
  return path;
}

const VIGENCIA_URL_FIRMADA_S = 60 * 60;

export async function urlsFirmadas(rutas, bucket = BUCKET_CONSULTAS, segundos = VIGENCIA_URL_FIRMADA_S) {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!unicas.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unicas, segundos);
  if (error) throw error;
  const porRuta = {};
  for (const f of data ?? []) if (f.signedUrl && !f.error) porRuta[f.path] = f.signedUrl;
  return porRuta;
}

export async function borrarArchivoPrivado(path, bucket = BUCKET_CONSULTAS) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]).catch(() => {});
}

export async function borrarImagenPublica(url) {
  if (!esUrlPropia(url) || typeof url !== 'string' || url.startsWith('data:')) return;
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url);
  if (!m) return;
  const [, bucket, pathCodificado] = m;
  await borrarArchivoPrivado(decodeURIComponent(pathCodificado), bucket);
}

export async function borrarImagenesPublicas(urls) {
  await Promise.all((urls ?? []).map(borrarImagenPublica));
}

export async function subirArchivoPublico(uri, carpeta, { bucket = BUCKET } = {}) {
  const { path, mime } = await subir(uri, carpeta, bucket);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, tipo: mime.startsWith('video/') ? 'video' : 'imagen' };
}
