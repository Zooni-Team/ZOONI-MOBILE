/**
 * useRegistrosSalud.js — Carga de las pantallas de Vacunas y Tratamientos: la
 * mascota, lo que ya tiene registrado y lo que le sugiere el calendario.
 *
 *   const salud = useRegistrosSalud(async (id) => {
 *     const { mascota, aplicadas, sugeridas } = await fetchVacunas(id);
 *     return { mascota, aplicados: aplicadas, sugeridos: sugeridas };
 *   });
 *
 * La mascota sale del parámetro de navegación `petId` o, si no vino, de la
 * mascota activa; el selector de la pantalla la cambia con `setPetId`.
 *
 * Si la consulta falla NO se inventa nada: queda lo último que se había
 * cargado (o la mascota vacía) y `error` en true para que la pantalla avise.
 */

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

  // La función cambia en cada render de la pantalla; se guarda en un ref para
  // que `cargar` sólo dependa de la mascota.
  const traerRef = useRef(traer);
  traerRef.current = traer;
  // Si se cambia de mascota mientras carga, la respuesta vieja se descarta.
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
