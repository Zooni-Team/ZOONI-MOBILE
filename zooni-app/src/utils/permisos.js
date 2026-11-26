/**
 * permisos.js — Estado REAL de los permisos que usa Zooni (Configuración ›
 * Permisos de la app). Sólo lee: los permisos los otorga el sistema, y se
 * piden en el momento en que hacen falta (elegirImagen, el mapa, el paseo).
 *
 * Estados: 'permitido' · 'denegado' · 'sin_pedir' (todavía no se preguntó) ·
 * 'no_aplica' (en esta plataforma no hace falta pedirlo) · 'desconocido'
 * (el sistema no deja consultarlo sin pedirlo).
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function deExpo(permiso) {
  if (!permiso) return 'desconocido';
  if (permiso.granted) return 'permitido';
  if (permiso.status === 'denied') return 'denegado';
  return 'sin_pedir';
}

// En web: Permissions API del navegador. Safari no conoce todos los nombres
// (tira error): eso no es un "denegado", es "no se puede saber".
async function deNavegador(nombre) {
  try {
    const r = await navigator.permissions.query({ name: nombre });
    return { granted: 'permitido', denied: 'denegado', prompt: 'sin_pedir' }[r.state] ?? 'desconocido';
  } catch {
    return 'desconocido';
  }
}

/** { ubicacion, camara, fotos } con el estado de cada uno. Nunca tira. */
export async function estadoDePermisos() {
  if (Platform.OS === 'web') {
    const [ubicacion, camara] = await Promise.all([deNavegador('geolocation'), deNavegador('camera')]);
    // En la web las fotos se eligen con el selector de archivos: no hay permiso.
    return { ubicacion, camara, fotos: 'no_aplica' };
  }
  const [camara, fotos] = await Promise.all([
    ImagePicker.getCameraPermissionsAsync().then(deExpo, () => 'desconocido'),
    ImagePicker.getMediaLibraryPermissionsAsync().then(deExpo, () => 'desconocido'),
  ]);
  // La ubicación se pide con la geolocalización del sistema al usarla (mapa,
  // paseos, SOS); sin expo-location no hay forma de consultarla antes.
  return { ubicacion: 'desconocido', camara, fotos };
}
