/**
 * useUsuarioActivo.js — Usuario y mascota activa para el HamburgerDrawer
 *
 * Muchas pantallas (Comunidad, Ficha Médica, Closet, etc.) no necesitan
 * el resto de los datos de /home, pero sí necesitan mostrar el usuario
 * y la mascota activa en el menú lateral, igual que HomeScreen.
 *
 * NO devuelve datos de demo. Antes arrancaba con un usuario y una mascota
 * inventados ("Sofía" / "Titán, Labrador Retriever") y los dejaba puestos si
 * el backend tardaba más de 3 segundos: con red lenta el menú lateral mostraba
 * una mascota que no era la del usuario. Ahora devuelve null hasta que llegan
 * los datos reales y el drawer muestra su propio estado de carga.
 */

import { useEffect, useState } from 'react';

import { fetchHome } from '../services/api';
import { haySesion } from '../config/session';

// Cortafuegos para no quedar cargando para siempre si el backend nunca contesta.
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
        // Sin datos reales no se inventa un usuario: el drawer queda en blanco,
        // que es preferible a mostrarle al usuario una mascota ajena.
      } finally {
        clearTimeout(cortar);
        if (!cancelado) setCargando(false);
      }
    })();

    return () => { cancelado = true; };
  }, []);

  return { usuario, mascotaActiva, cargando };
}
