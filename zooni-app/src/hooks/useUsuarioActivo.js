import { useEffect, useState } from 'react';

import { fetchHome } from '../services/api';
import { haySesion } from '../config/session';

const TIMEOUT_MS = 12000;

export function useUsuarioActivo() {
  const [usuario, setUsuario] = useState(null);
  const [mascotaActiva, setMascotaActiva] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      if (!haySesion()) { setCargando(false); return; }
      let cortar;
      try {
        const data = await Promise.race([
          fetchHome(),
          new Promise((_, reject) => {
            cortar = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
          }),
        ]);
        if (cancelado) return;
        setUsuario(data?.usuario ?? null);
        setMascotaActiva(data?.mascotaActiva ?? null);
      } catch {
      } finally {
        clearTimeout(cortar);
        if (!cancelado) setCargando(false);
      }
    })();

    return () => { cancelado = true; };
  }, []);

  return { usuario, mascotaActiva, cargando };
}
