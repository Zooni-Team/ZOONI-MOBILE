import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';

import { MASCOTA_VACIA } from '../constants/mascotaVacia';
import { useUsuarioActivo } from './useUsuarioActivo';

export function useRegistrosSalud(traer) {
  const route = useRoute();
  const { mascotaActiva } = useUsuarioActivo();
  const [petId, setPetId] = useState(route.params?.petId ?? null);
  const idMascota = petId ?? mascotaActiva?.id ?? null;

  const [mascota, setMascota] = useState(null);
  const [aplicados, setAplicados] = useState([]);
  const [sugeridos, setSugeridos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const traerRef = useRef(traer);
  traerRef.current = traer;
  const pedido = useRef(0);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const este = ++pedido.current;
    if (!silencioso) setCargando(true);
    try {
      const datos = idMascota
        ? await traerRef.current(idMascota)
        : { mascota: MASCOTA_VACIA, aplicados: [], sugeridos: [] };
      if (este !== pedido.current) return;
      setMascota(datos.mascota);
      setAplicados(datos.aplicados);
      setSugeridos(datos.sugeridos);
      setError(false);
    } catch {
      if (este !== pedido.current) return;
      setError(true);
    } finally {
      if (este === pedido.current) setCargando(false);
    }
  }, [idMascota]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar({ silencioso: true });
    setRefrescando(false);
  }, [cargar]);

  return {
    idMascota, petId, setPetId,
    mascota: mascota ?? MASCOTA_VACIA,
    aplicados, setAplicados, sugeridos, setSugeridos,
    cargando, refrescando, refrescar, error, reintentar: cargar,
  };
}
