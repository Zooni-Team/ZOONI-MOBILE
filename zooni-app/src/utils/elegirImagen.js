/**
 * elegirImagen.js — elegir una foto (o foto/video, para reseñas) de la
 * galería o la cámara.
 *
 * Único lugar que pide permiso y abre expo-image-picker: antes cada pantalla
 * lo hacía por su cuenta, con mensajes y opciones levemente distintos (ver
 * faltaporhacer.md). Además recomprime cada foto con expo-image-manipulator
 * antes de devolverla, lo que descarta sus metadatos EXIF (incluye la
 * ubicación GPS de quien sacó la foto) — informe de seguridad #69: ninguna
 * foto subida a un bucket público debe llevar esos datos.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { alerta } from './dialogo';

const CALIDAD_DEFAULT = 0.7;

async function pedirPermiso(camara) {
  const permiso = camara
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    alerta('Sin permiso', `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración del dispositivo.`);
    return false;
  }
  return true;
}

/** Recomprime y quita los metadatos EXIF de una foto. Si no se puede (ej. un
 * formato que el manipulador no soporta), se sube la original. */
async function limpiarExif(uri, calidad) {
  try {
    const res = await ImageManipulator.manipulateAsync(uri, [], {
      compress: calidad,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return res.uri;
  } catch {
    return uri;
  }
}

/**
 * Elige UNA foto. Devuelve la uri lista para subir, o `null` si se canceló o
 * no había permiso.
 *
 * opciones: `origen` ('galeria' | 'camara'), `calidad` (0–1), `allowsEditing`,
 * `aspect` ([ancho, alto], con `allowsEditing`), `frontal` (cámara frontal,
 * para selfies), `quitarExif` (default true).
 */
export async function elegirImagen(opciones = {}) {
  const {
    origen = 'galeria', calidad = CALIDAD_DEFAULT, allowsEditing = false, aspect, frontal = false, quitarExif = true,
  } = opciones;
  const camara = origen === 'camara';
  if (!(await pedirPermiso(camara))) return null;

  const opcionesPicker = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: calidad, allowsEditing, aspect };
  if (frontal) opcionesPicker.cameraType = ImagePicker.CameraType.front;

  const res = camara
    ? await ImagePicker.launchCameraAsync(opcionesPicker)
    : await ImagePicker.launchImageLibraryAsync(opcionesPicker);
  if (res.canceled || !res.assets?.[0]?.uri) return null;

  const uri = res.assets[0].uri;
  return quitarExif ? limpiarExif(uri, calidad) : uri;
}

/**
 * Elige una o varias fotos/video (reseñas de paseo). Devuelve
 * `[{ uri, mimeType, tipo: 'imagen' | 'video', fileSize }]`, o `[]` si se
 * canceló o no había permiso. `limite`: cuántos ítems se pueden elegir de la
 * galería. `fileSize` es el tamaño original (antes de quitar EXIF), para que
 * quien llama pueda filtrar por peso máximo.
 */
export async function elegirMultimedia(opciones = {}) {
  const { origen = 'galeria', limite = 1, duracionMaxVideo = 60, calidad = CALIDAD_DEFAULT } = opciones;
  const camara = origen === 'camara';
  if (!(await pedirPermiso(camara))) return [];

  const opcionesPicker = {
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: calidad,
    videoMaxDuration: duracionMaxVideo,
    allowsMultipleSelection: !camara,
    selectionLimit: limite,
  };
  const res = camara
    ? await ImagePicker.launchCameraAsync(opcionesPicker)
    : await ImagePicker.launchImageLibraryAsync(opcionesPicker);
  if (res.canceled) return [];

  return Promise.all((res.assets ?? []).map(async (a) => {
    const esVideo = a.type === 'video' || a.mimeType?.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(a.uri);
    const uri = esVideo ? a.uri : await limpiarExif(a.uri, calidad);
    return { uri, mimeType: a.mimeType, tipo: esVideo ? 'video' : 'imagen', fileSize: a.fileSize };
  }));
}
