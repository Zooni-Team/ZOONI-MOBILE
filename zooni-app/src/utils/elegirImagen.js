import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { alerta } from './dialogo';
import { getSettings } from '../services/settingsStore';

export const CALIDAD_FOTO = 0.7;

const CALIDAD_POR_PREFERENCIA = { high: 0.85, medium: CALIDAD_FOTO, low: 0.5 };

export function calidadDeSubida() {
  return CALIDAD_POR_PREFERENCIA[getSettings().device.upload_quality] ?? CALIDAD_FOTO;
}

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

export async function elegirImagen({ camara = false, cuadrada = false, frontal = false, calidad = calidadDeSubida() } = {}) {
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

export async function elegirMedios({ camara = false, limite = 1, videoMaxSegundos = 60 } = {}) {
  if (!(await pedirPermiso(camara))) return [];
  const opciones = {
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: calidadDeSubida(),
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
    return { ...a, uri: await limpiarExif(a.uri, calidadDeSubida()) };
  }));
}
