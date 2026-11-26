import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function deExpo(permiso) {
  if (!permiso) return 'desconocido';
  if (permiso.granted) return 'permitido';
  if (permiso.status === 'denied') return 'denegado';
  return 'sin_pedir';
}

async function deNavegador(nombre) {
  try {
    const r = await navigator.permissions.query({ name: nombre });
    return { granted: 'permitido', denied: 'denegado', prompt: 'sin_pedir' }[r.state] ?? 'desconocido';
  } catch {
    return 'desconocido';
  }
}

export async function estadoDePermisos() {
  if (Platform.OS === 'web') {
    const [ubicacion, camara] = await Promise.all([deNavegador('geolocation'), deNavegador('camera')]);
    return { ubicacion, camara, fotos: 'no_aplica' };
  }
  const [camara, fotos] = await Promise.all([
    ImagePicker.getCameraPermissionsAsync().then(deExpo, () => 'desconocido'),
    ImagePicker.getMediaLibraryPermissionsAsync().then(deExpo, () => 'desconocido'),
  ]);
  return { ubicacion: 'desconocido', camara, fotos };
}
