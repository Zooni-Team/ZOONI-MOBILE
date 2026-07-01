/**
 * useUsuarioActivo.js — Usuario y mascota activa para el HamburgerDrawer
 *
 * Muchas pantallas (Comunidad, Ficha Médica, Closet, etc.) no necesitan
 * el resto de los datos de /home, pero sí necesitan mostrar el usuario
 * y la mascota activa en el menú lateral, igual que HomeScreen.
 *
 * Devuelve datos demo al instante y los reemplaza si el backend responde
 * a tiempo (mismo patrón de timeout de 3s que usa HomeScreen).
 */

import { useEffect, useState } from 'react';

import { fetchHome } from '../services/api';
import { DEMO_USUARIO, DEMO_MASCOTA_ACTIVA } from '../constants/demoUsuario';

export function useUsuarioActivo() {
  const [usuario, setUsuario] = useState(DEMO_USUARIO);
  const [mascotaActiva, setMascotaActiva] = useState(DEMO_MASCOTA_ACTIVA);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const data = await Promise.race([
          fetchHome(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]);
        if (cancelado) return;
        if (data?.usuario) setUsuario(data.usuario);
        if (data?.mascotaActiva) setMascotaActiva(data.mascotaActiva);
      } catch {
        // Sin backend a tiempo: se mantienen los valores demo
      }
    })();

    return () => { cancelado = true; };
  }, []);

  return { usuario, mascotaActiva };
}
