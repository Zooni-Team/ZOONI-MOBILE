import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { escucharCambios } from '../services/tiempoReal';
import { INTERVALO_CHAT_RESPALDO_MS } from '../constants/intervalos';

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
        try { await cargarRef.current(); } catch {  }
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
    }, [cargar, cargarUnaVez, tabla, filtro, activo, respaldoMs])
  );
}
