/**
 * elegirImagen.js — Pedir permiso y elegir una foto (galería o cámara).
 *
 * Antes cada pantalla repetía lo mismo (permiso → aviso si no lo dan →
 * launchImageLibrary/launchCamera → leer assets[0].uri), con pequeñas
 * diferencias que nadie había elegido a propósito. Ahora:
 *
 *   const uri = await elegirImagen();                       // galería
 *   const uri = await elegirImagen({ camara: true });       // cámara
 *   const uri = await elegirImagen({ cuadrada: true });     // recorte 1:1 (logos, avatares)
 *   if (!uri) return;                                       // canceló o sin permiso
 *
 * Sin permiso avisa con alerta() (que también anda en web) y devuelve null.
 * Para varias fotos y videos a la vez (reseñas) está elegirMedios.
 *
 * Toda foto que sale de acá pasa por limpiarExif(): se recomprime con
 * expo-image-manipulator, lo que descarta sus metadatos EXIF (incluida la
 * ubicación GPS de quien la sacó) — informe de seguridad #69: ninguna foto
 * que termine en un bucket público debe llevar esos datos.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { alerta } from './dialogo';

/** Calidad JPEG por defecto: buena para pantalla, liviana para subir. */
export const CALIDAD_FOTO = 0.7;

async function pedirPermiso(camara) {
  const permiso = camara
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permiso.granted) return true;
  alerta(
    'Sin permiso',
    `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración del dispositivo.`,
  );
  return false;
}

/**
 * Recomprime la foto para que el archivo resultante no tenga EXIF (#69). Si el
 * manipulador no soporta el formato, se devuelve la original: perder la foto
 * sería peor que subirla con metadatos.
 */
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
 * Devuelve la uri local de la foto elegida (ya sin EXIF), o null si canceló o
 * no hay permiso.
 * opciones: { camara = false, cuadrada = false, frontal = false, calidad }
 */
export async function elegirImagen({ camara = false, cuadrada = false, frontal = false, calidad = CALIDAD_FOTO } = {}) {
  if (!(await pedirPermiso(camara))) return null;

  const opciones = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: calidad,
    ...(cuadrada ? { allowsEditing: true, aspect: [1, 1] } : {}),
  };
  const res = camara
    ? await ImagePicker.launchCameraAsync({
      ...opciones,
      ...(frontal ? { cameraType: ImagePicker.CameraType.front } : {}),
    })
    : await ImagePicker.launchImageLibraryAsync(opciones);

  if (res.canceled) return null;
  const uri = res.assets?.[0]?.uri ?? null;
  return uri ? limpiarExif(uri, calidad) : null;
}

/**
 * Varias fotos y videos (galería) o uno (cámara). Devuelve los assets de
 * expo-image-picker tal cual ([] si canceló o no hay permiso), porque quien
 * llama necesita mimeType, duración y tamaño para filtrar — sólo se reemplaza
 * la `uri` de las imágenes por la versión sin EXIF (los videos van tal cual:
 * el manipulador no los toca).
 * opciones: { camara = false, limite = 1, videoMaxSegundos = 60 }
 */
export async function elegirMedios({ camara = false, limite = 1, videoMaxSegundos = 60 } = {}) {
  if (!(await pedirPermiso(camara))) return [];
  const opciones = {
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: CALIDAD_FOTO,
    videoMaxDuration: videoMaxSegundos,
    allowsMultipleSelection: !camara,
    selectionLimit: limite,
  };
  const res = camara
    ? await ImagePicker.launchCameraAsync(opciones)
    : await ImagePicker.launchImageLibraryAsync(opciones);
  if (res.canceled) return [];

  return Promise.all((res.assets ?? []).map(async (a) => {
    const esVideo = a.type === 'video'
      || a.mimeType?.startsWith('video/')
      || /\.(mp4|mov|m4v|webm|3gp)$/i.test(a.uri ?? '');
    if (esVideo || !a.uri) return a;
    return { ...a, uri: await limpiarExif(a.uri, CALIDAD_FOTO) };
  }));
}
