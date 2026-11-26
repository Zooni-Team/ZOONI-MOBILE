import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

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
  const destino = `${FileSystem.cacheDirectory}ficha-mascota-${Date.now()}`;
  try {
    const { uri: local } = await FileSystem.downloadAsync(url, destino);
    const base64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${tipoMime(url)};base64,${base64}`;
  } finally {
    FileSystem.deleteAsync(destino, { idempotent: true }).catch(() => {});
  }
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

export async function imagenADataUri(source) {
  try {
    if (!source) return null;
    if (typeof source === 'number') return await desdeAssetLocal(source);
    if (typeof source === 'object' && source.uri) {
      if (String(source.uri).startsWith('data:')) return source.uri;
      return await desdeUrl(source.uri);
    }
    return null;
  } catch {
    return null;
  }
}
