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
