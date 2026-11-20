/**
 * useAvataresCloset — Datos de la pantalla Closet: la mascota que se viste,
 * los avatares de su especie y "aplicar" uno. La pantalla sólo dibuja y anima.
 *
 *   const { mascota, avatares, cargando, aplicando, aplicar } = useAvataresCloset(petId);
 *   const r = await aplicar('perro_bandana');   // { ok } | { error: 'sin_permiso' | 'error' }
 *
 * Los errores se avisan con utils/dialogo (alerta): Alert.alert no muestra
 * nada en la web, y antes la pantalla esperaba errores con forma de axios
 * (`err.response`) que Supabase nunca manda, así que todo fallo se mostraba
 * como "Sin conexión".
 */

import { useCallback, useEffect, useState } from 'react';

import { aplicarAvatar, fetchAvatares } from '../services/api';
import { esSinPermiso } from '../services/comun';
import { alerta } from '../utils/dialogo';

export function useAvataresCloset(petId) {
  const [mascota, setMascota] = useState(null);
  const [avatares, setAvatares] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);

  const cargar = useCallback(async () => {
    if (!petId) return;
    setCargando(true);
    try {
      const data = await fetchAvatares(petId);
      setMascota(data.mascota);
      setAvatares(data.avatares);
    } catch {
      alerta('No se pudieron cargar los avatares', 'Revisá tu conexión e intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [petId]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicar = useCallback(async (imagenAsset) => {
    setAplicando(true);
    try {
      await aplicarAvatar(petId, imagenAsset);
      setMascota((prev) => (prev ? { ...prev, imagen_asset: imagenAsset } : prev));
      return { ok: true };
    } catch (err) {
      // .single() sin filas (PGRST116) = la RLS no dejó tocar esa mascota
      if (esSinPermiso(err) || err?.code === 'PGRST116') {
        alerta('Sin permiso', 'No podés modificar esta mascota.');
        return { error: 'sin_permiso' };
      }
      alerta('No se pudo aplicar el avatar', 'Revisá tu conexión e intentá de nuevo.');
      return { error: 'error' };
    } finally {
      setAplicando(false);
    }
  }, [petId]);

  return { mascota, avatares, cargando, aplicando, aplicar, recargar: cargar };
}
