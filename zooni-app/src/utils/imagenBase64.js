/**
 * imagenBase64.js — Convierte la imagen de una mascota en un data URI
 *
 * Hace falta para el PDF de la Ficha Médica: ni expo-print ni jsPDF pueden
 * cargar una URL remota por su cuenta de forma confiable (el PDF se genera
 * antes de que la imagen termine de bajar y sale el hueco en blanco), así que
 * la imagen se incrusta ya convertida a base64.
 *
 * Cubre los dos tipos de fuente que devuelve resolveMascotaVisual():
 *   · { uri: 'https://…' }  → foto real subida por el usuario
 *   · require('…png')       → ilustración local (número de módulo)
 *
 * Nunca tira error: si algo falla devuelve null y el PDF sale sin foto.
 */

import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

/** Blob → "data:image/png;base64,…" (camino web) */
function blobADataUri(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function tipoMime(uri) {
  const limpia = String(uri).split('?')[0].toLowerCase();
  if (limpia.endsWith('.jpg') || limpia.endsWith('.jpeg')) return 'image/jpeg';
  if (limpia.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

async function desdeUrl(url) {
  if (Platform.OS === 'web') {
    const res = await fetch(url);
    if (!res.ok) return null;
    return blobADataUri(await res.blob());
  }
  // En nativo se baja a un archivo temporal y se lee en base64: fetch + Blob
  // en React Native no siempre soporta readAsDataURL.
  const destino = `${FileSystem.cacheDirectory}ficha-mascota-${Date.now()}`;
  const { uri: local } = await FileSystem.downloadAsync(url, destino);
  const base64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${tipoMime(url)};base64,${base64}`;
}

async function desdeAssetLocal(modulo) {
  const asset = Asset.fromModule(modulo);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) return null;

  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) return null;
    return blobADataUri(await res.blob());
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${tipoMime(uri)};base64,${base64}`;
}

/**
 * @param {number|object} source  lo que devuelve resolveMascotaVisual()
 * @returns {Promise<string|null>} data URI, o null si no se pudo
 */
export async function imagenADataUri(source) {
  try {
    if (!source) return null;
    if (typeof source === 'number') return await desdeAssetLocal(source);   // require()
    if (typeof source === 'object' && source.uri) {
      // Un data URI ya viene listo
      if (String(source.uri).startsWith('data:')) return source.uri;
      return await desdeUrl(source.uri);
    }
    return null;
  } catch {
    return null; // el PDF sale sin foto, no se cancela la descarga
  }
}
