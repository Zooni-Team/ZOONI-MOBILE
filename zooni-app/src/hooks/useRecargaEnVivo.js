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

import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { escucharCambios } from '../services/tiempoReal';
import { INTERVALO_CHAT_RESPALDO_MS } from '../constants/intervalos';

export function useRecargaEnVivo(cargar, { tabla, filtro, activo = true, respaldoMs = INTERVALO_CHAT_RESPALDO_MS }) {
  useFocusEffect(
    useCallback(() => {
      cargar();
      if (!activo) return undefined;
      const dejarDeEscuchar = escucharCambios({ tabla, filtro, alCambiar: cargar });
      const respaldo = setInterval(cargar, respaldoMs);
      return () => {
        dejarDeEscuchar();
        clearInterval(respaldo);
      };
    }, [cargar, tabla, filtro, activo, respaldoMs])
  );
}
