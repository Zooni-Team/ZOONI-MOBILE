/**
 * src/hooks/comunidad/usePolling.js
 *
 * Hook que ejecuta polling cada 30 segundos mientras la pantalla Comunidad
 * está activa:
 *   1. PUT /ubicacion  — solo si compartirUbicacion es true y hay ubicación disponible
 *   2. GET /comunidad/mapa — refresca los markers del mapa
 *
 * Limpia el intervalo automáticamente al desmontar el componente.
 *
 * Uso:
 *   usePolling({
 *     ubicacion,            // { lat, lng } | null
 *     boundingBox,          // BoundingBox
 *     compartirUbicacion,   // boolean
 *     onMarkersActualizados // callback(markers)
 *   });
 */

import { useEffect, useRef } from 'react';
import { actualizarUbicacion } from '../../api/comunidad/ubicacionApi';
import { fetchMapaData } from '../../api/comunidad/mapaApi';

/** Intervalo de polling en milisegundos (30 segundos) */
const POLLING_INTERVAL_MS = 30_000;

/**
 * @param {Object} params
 * @param {{ lat: number, lng: number } | null} params.ubicacion
 *   Coordenadas actuales del usuario. Si es null, no se envía la ubicación.
 * @param {import('../../types/comunidad').BoundingBox} params.boundingBox
 *   Rectángulo visible del mapa usado para la consulta de markers.
 * @param {boolean} params.compartirUbicacion
 *   Cuando es true, se envía la ubicación al servidor en cada ciclo.
 * @param {(markers: import('../../types/comunidad').MapaData) => void} params.onMarkersActualizados
 *   Callback invocado con los nuevos datos del mapa tras cada GET /mapa exitoso.
 */
export function usePolling({
  ubicacion,
  boundingBox,
  compartirUbicacion,
  onMarkersActualizados,
}) {
  // Usamos refs para que el intervalo siempre acceda a los valores más recientes
  // sin necesidad de recrearlo cada vez que cambian las props.
  const ubicacionRef = useRef(ubicacion);
  const boundingBoxRef = useRef(boundingBox);
  const compartirUbicacionRef = useRef(compartirUbicacion);
  const onMarkersActualizadosRef = useRef(onMarkersActualizados);

  // Mantener las refs sincronizadas con los valores actuales
  useEffect(() => {
    ubicacionRef.current = ubicacion;
  }, [ubicacion]);

  useEffect(() => {
    boundingBoxRef.current = boundingBox;
  }, [boundingBox]);

  useEffect(() => {
    compartirUbicacionRef.current = compartirUbicacion;
  }, [compartirUbicacion]);

  useEffect(() => {
    onMarkersActualizadosRef.current = onMarkersActualizados;
  }, [onMarkersActualizados]);

  useEffect(() => {
    /**
     * Ejecuta un ciclo de polling:
     *   1. Envía la ubicación si corresponde.
     *   2. Refresca los markers del mapa.
     *
     * Los errores se capturan individualmente para que un fallo en el PUT
     * no impida el GET y viceversa.
     */
    async function tick() {
      // 1. Actualizar ubicación (solo si el usuario lo permite y hay coordenadas)
      if (compartirUbicacionRef.current && ubicacionRef.current) {
        const { lat, lng } = ubicacionRef.current;
        try {
          await actualizarUbicacion(lat, lng);
        } catch (error) {
          // Error no crítico: continuar con el refresh del mapa
          console.warn('[usePolling] Error al actualizar ubicación:', error?.message ?? error);
        }
      }

      // 2. Refrescar markers del mapa
      if (boundingBoxRef.current) {
        try {
          const markers = await fetchMapaData(boundingBoxRef.current);
          onMarkersActualizadosRef.current?.(markers);
        } catch (error) {
          // Error no crítico: los markers existentes permanecen en pantalla
          console.warn('[usePolling] Error al refrescar mapa:', error?.message ?? error);
        }
      }
    }

    const intervalId = setInterval(tick, POLLING_INTERVAL_MS);

    // Cleanup: limpiar el intervalo al desmontar o cuando cambie el efecto
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Sin dependencias: el intervalo se crea una sola vez y usa refs para los valores actuales
}
