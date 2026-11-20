/**
 * useRecargaEnVivo — Mientras la pantalla está en foco, vuelve a llamar a
 * `cargar` cada vez que cambia algo en `tabla` (Supabase Realtime, ver
 * services/tiempoReal.js).
 *
 *   useRecargaEnVivo(cargar, { tabla: 'Mensaje', filtro: `idMatch=eq.${id}` });
 *
 * Además consulta cada INTERVALO_CHAT_RESPALDO_MS como red de seguridad: si
 * el socket se cae (datos móviles, app en segundo plano), lo perdido llega
 * igual, sólo que más tarde. Con `activo: false` no hace nada.
 *
 * `cargar` tiene que ser estable (useCallback): si cambia, se re-suscribe.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { escucharCambios } from '../services/tiempoReal';
import { INTERVALO_CHAT_RESPALDO_MS } from '../constants/intervalos';

/**
 * Envuelve `cargar` para que nunca haya dos cargas a la vez: si llega un aviso
 * (Realtime en ráfaga, o el respaldo) mientras otra carga está en vuelo, se
 * anota UNA recarga más para cuando termine. Antes las cargas se superponían
 * y una respuesta vieja que llegaba tarde pisaba a una más nueva.
 */
function useCargaSerializada(cargar) {
  const cargarRef = useRef(cargar);
  useEffect(() => { cargarRef.current = cargar; }, [cargar]);
  const enVuelo = useRef(false);
  const pendiente = useRef(false);
  return useCallback(async () => {
    if (enVuelo.current) { pendiente.current = true; return; }
    enVuelo.current = true;
    try {
      do {
        pendiente.current = false;
        try { await cargarRef.current(); } catch { /* cada pantalla muestra su propio error */ }
      } while (pendiente.current);
    } finally {
      enVuelo.current = false;
    }
  }, []);
}

export function useRecargaEnVivo(cargar, { tabla, filtro, activo = true, respaldoMs = INTERVALO_CHAT_RESPALDO_MS }) {
  const cargarUnaVez = useCargaSerializada(cargar);
  useFocusEffect(
    useCallback(() => {
      cargarUnaVez();
      if (!activo) return undefined;
      const dejarDeEscuchar = escucharCambios({ tabla, filtro, alCambiar: cargarUnaVez });
      const respaldo = setInterval(cargarUnaVez, respaldoMs);
      return () => {
        dejarDeEscuchar();
        clearInterval(respaldo);
      };
      // `cargar` está en las dependencias a propósito: si cambia (otro chat),
      // se vuelve a cargar y a suscribir.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar, cargarUnaVez, tabla, filtro, activo, respaldoMs])
  );
}
