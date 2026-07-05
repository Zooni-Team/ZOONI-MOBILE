/**
 * imagenStorage.js — Subida de imágenes a Supabase Storage (bucket "public-images")
 *
 * En web, expo-image-picker devuelve un data URI ("data:image/png;base64,...")
 * en vez de una ruta con extensión, así que el tipo de imagen no se puede
 * sacar de la extensión del archivo — hay que leerlo del propio data URI.
 * En nativo (file://...) sí hay extensión, y no es un data URI.
 */

import { supabase } from '../lib/supabase';

const BUCKET = 'public-images';

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
  const path = `${carpeta}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, arraybuffer, {
    contentType: mime,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
