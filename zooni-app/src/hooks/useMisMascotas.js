/**
 * useMisMascotas.js — Lista de mascotas activas del usuario
 *
 * La usa SelectorMascota para ofrecer el cambio de mascota en las pantallas que
 * muestran datos de una sola (Ficha Médica, Vacunas, Tratamientos, Consultas,
 * Consejos, Closet). Antes cada una de esas pantallas leía el `petId` del
 * parámetro de navegación y lo dejaba fijo: con más de una mascota, la única
 * forma de mirar otra era volver al Home, cambiarla con las flechas del hero y
 * volver a entrar.
 *
 * Devuelve solo las ACTIVAS: las archivadas y las que están en memoria no
 * tienen ficha que consultar.
 */

import { useEffect, useState } from 'react';

import { fetchMisMascotas } from '../services/petsApi';
import { haySesion } from '../config/session';

export function useMisMascotas() {
  const [mascotas, setMascotas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!haySesion()) { setCargando(false); return; }
      try {
        const { activas } = await fetchMisMascotas();
        if (!cancelado) setMascotas(activas ?? []);
      } catch {
        // Sin la lista simplemente no se ofrece el cambio: la pantalla sigue
        // funcionando con la mascota que le llegó por parámetro.
        if (!cancelado) setMascotas([]);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return { mascotas, cargando };
}
