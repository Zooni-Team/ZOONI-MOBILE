/**
 * src/hooks/comunidad/useConexion.js
 *
 * Hook de detección de conexión y gestión de caché para la pantalla Comunidad.
 *
 * Exporta:
 *   - useConexion()              → { sinConexion: boolean }
 *   - guardarCacheMapaData(data) → Promise<void>
 *   - cargarCacheMapaData()      → Promise<MapaData | null>
 *
 * Comportamiento:
 *   - Suscribe a cambios de red con @react-native-community/netinfo.
 *   - Cancela la suscripción al desmontar el componente.
 *   - Persiste la última respuesta de GET /comunidad/mapa en AsyncStorage
 *     bajo la clave 'comunidad_mapa_cache'.
 *   - Cuando no hay conexión, cargarCacheMapaData() devuelve los datos
 *     cacheados para que la pantalla pueda mostrar el último estado conocido.
 */

import { useState, useEffect } from 'react';

/** Clave de AsyncStorage para la caché del mapa */
const CACHE_KEY = 'comunidad_mapa_cache';

// ---------------------------------------------------------------------------
// Helpers de caché (AsyncStorage)
// ---------------------------------------------------------------------------

/**
 * Guarda los datos del mapa en AsyncStorage.
 * Si AsyncStorage no está disponible (entorno web o paquete no instalado),
 * la operación se omite silenciosamente.
 *
 * @param {Object} data - Respuesta de GET /api/v1/comunidad/mapa
 * @returns {Promise<void>}
 */
export async function guardarCacheMapaData(data) {
  try {
    const AsyncStorage = await _getAsyncStorage();
    if (!AsyncStorage) return;

    const serializado = JSON.stringify(data);
    await AsyncStorage.setItem(CACHE_KEY, serializado);
  } catch (error) {
    // Error no crítico: la caché es un complemento, no un requisito
    console.warn('[useConexion] Error al guardar caché del mapa:', error?.message ?? error);
  }
}

/**
 * Carga los datos del mapa desde AsyncStorage.
 * Devuelve null si no hay caché o si ocurre algún error.
 *
 * @returns {Promise<Object | null>}
 */
export async function cargarCacheMapaData() {
  try {
    const AsyncStorage = await _getAsyncStorage();
    if (!AsyncStorage) return null;

    const serializado = await AsyncStorage.getItem(CACHE_KEY);
    if (!serializado) return null;

    return JSON.parse(serializado);
  } catch (error) {
    console.warn('[useConexion] Error al cargar caché del mapa:', error?.message ?? error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * Detecta el estado de la conexión de red y expone si el dispositivo
 * está sin conexión.
 *
 * Suscribe a los cambios de red al montar y cancela la suscripción al desmontar.
 *
 * @returns {{ sinConexion: boolean }}
 *
 * @example
 * const { sinConexion } = useConexion();
 *
 * if (sinConexion) {
 *   // Mostrar banner "Sin conexión" y cargar datos desde caché
 * }
 */
function useConexion() {
  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    let unsubscribe = null;
    let cancelado = false;

    async function iniciarSuscripcion() {
      try {
        const NetInfo = await _getNetInfo();
        if (!NetInfo || cancelado) return;

        // Obtener el estado inicial de la red
        const estadoInicial = await NetInfo.fetch();
        if (!cancelado) {
          setSinConexion(!_estaConectado(estadoInicial));
        }

        // Suscribirse a cambios futuros
        unsubscribe = NetInfo.addEventListener((estado) => {
          if (!cancelado) {
            setSinConexion(!_estaConectado(estado));
          }
        });
      } catch (error) {
        // Si NetInfo no está disponible, asumir que hay conexión
        console.warn('[useConexion] NetInfo no disponible:', error?.message ?? error);
        if (!cancelado) {
          setSinConexion(false);
        }
      }
    }

    iniciarSuscripcion();

    return () => {
      cancelado = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return { sinConexion };
}

export default useConexion;

// ---------------------------------------------------------------------------
// Helpers de importación dinámica (permiten usar el hook en entornos donde
// los paquetes nativos no están instalados, como tests o web)
// ---------------------------------------------------------------------------

/**
 * Importa @react-native-community/netinfo de forma dinámica.
 * Devuelve null si el paquete no está disponible.
 *
 * @returns {Promise<import('@react-native-community/netinfo').default | null>}
 */
async function _getNetInfo() {
  try {
    const module = await import('@react-native-community/netinfo');
    return module.default ?? module;
  } catch {
    return null;
  }
}

/**
 * Importa @react-native-async-storage/async-storage de forma dinámica.
 * Devuelve null si el paquete no está disponible.
 *
 * @returns {Promise<import('@react-native-async-storage/async-storage').default | null>}
 */
async function _getAsyncStorage() {
  try {
    const module = await import('@react-native-async-storage/async-storage');
    return module.default ?? module;
  } catch {
    return null;
  }
}

/**
 * Determina si un estado de NetInfo indica conexión activa.
 * Considera conectado cuando isConnected es true e isInternetReachable no es false.
 *
 * @param {{ isConnected: boolean | null, isInternetReachable: boolean | null }} estado
 * @returns {boolean}
 */
function _estaConectado(estado) {
  if (!estado) return true; // Asumir conectado si no hay información
  const { isConnected, isInternetReachable } = estado;
  // isInternetReachable puede ser null cuando aún no se determinó
  if (isConnected === false) return false;
  if (isInternetReachable === false) return false;
  return true;
}
