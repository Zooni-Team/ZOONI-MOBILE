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
        if (!cancelado) setMascotas([]);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return { mascotas, cargando };
}
