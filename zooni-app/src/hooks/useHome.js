import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { activarMascota, fetchHome, fetchHomeConfig, saveHomeConfig } from '../services/api';
import { actualizarMascota } from '../services/petsApi';

export const MAX_BOTONES_HOME = 4;

const BOTONES_POR_DEFECTO = [
  { seccion: 'comunidad', orden: 1, visible: true },
  { seccion: 'ficha_medica', orden: 2, visible: true },
  { seccion: 'match', orden: 3, visible: true },
];

const TIMEOUT_MS = 12000;

function conLimite(promesa, ms) {
  let cortar;
  const limite = new Promise((_, reject) => { cortar = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(cortar));
}

export function useHome() {
  const [datos, setDatos] = useState(null);
  const [botones, setBotones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const [home, config] = await conLimite(Promise.all([fetchHome(), fetchHomeConfig()]), TIMEOUT_MS);
      setDatos(home);
      setBotones(config.botones);
      setError(false);
    } catch {
      setBotones((prev) => (prev.length ? prev : BOTONES_POR_DEFECTO));
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar({ silencioso: true });
    setRefrescando(false);
  }, [cargar]);

  const elegirMascota = useCallback((mascota) => {
    setDatos((d) => (d ? { ...d, mascotaActiva: mascota } : d));
    activarMascota(mascota.id).catch(() => cargar({ silencioso: true }));
  }, [cargar]);

  const mostrarFoto = useCallback((idMascota, mostrar) => {
    setDatos((d) => (d ? {
      ...d,
      mascotaActiva: { ...d.mascotaActiva, mostrarFoto: mostrar },
      mascotas: (d.mascotas ?? []).map((m) => (m.id === idMascota ? { ...m, mostrarFoto: mostrar } : m)),
    } : d));
    actualizarMascota(idMascota, { mostrarFoto: mostrar }).catch(() => cargar({ silencioso: true }));
  }, [cargar]);

  const marcarNotificacionesLeidas = useCallback(() => {
    setDatos((d) => (d ? { ...d, notificacionesNoLeidas: 0 } : d));
  }, []);

  const quitarBoton = useCallback((seccion) => {
    setBotones((prev) => prev.filter((b) => b.seccion !== seccion));
  }, []);

  const agregarBoton = useCallback((seccion) => {
    setBotones((prev) => (prev.filter((b) => b.visible).length >= MAX_BOTONES_HOME
      ? prev
      : [...prev, { seccion, orden: prev.length + 1, visible: true }]));
  }, []);

  const guardarBotones = useCallback(async () => {
    const ordenados = botones.map((b, i) => ({ ...b, orden: i + 1, visible: true }));
    setBotones(ordenados);
    await saveHomeConfig({ botones: ordenados });
  }, [botones]);

  const mascota = datos?.mascotaActiva ?? null;
  return {
    usuario: datos?.usuario ?? null,
    mascota,
    mascotas: datos?.mascotas ?? (mascota ? [mascota] : []),
    sinLeer: datos?.notificacionesNoLeidas ?? 0,
    botones, botonesVisibles: botones.filter((b) => b.visible),
    reordenarBotones: setBotones, quitarBoton, agregarBoton, guardarBotones,
    elegirMascota, mostrarFoto, marcarNotificacionesLeidas,
    cargando, refrescando, refrescar, error, reintentar: cargar,
  };
}
