import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { fetchEventos } from '../services/api';
import { agregarEventoCalendario, getEventosCalendario } from '../services/calendarioStore';
import { colores } from '../theme';
import { eventoAplicaAMascota } from '../utils/filtrarPorMascota';
import { useMisMascotas } from './useMisMascotas';
import { useUsuarioActivo } from './useUsuarioActivo';

async function traerEventos(ciudad) {
  const { eventos } = await fetchEventos(ciudad);
  if (eventos.length || !ciudad) return eventos;
  return (await fetchEventos(null)).eventos;
}

export function useEventosPublicos() {
  const { usuario, mascotaActiva, cargando: cargandoUsuario } = useUsuarioActivo();
  const { mascotas } = useMisMascotas();
  const [mascotaElegidaId, setMascotaElegidaId] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [agregados, setAgregados] = useState(() => new Set());
  const [procesando, setProcesando] = useState(() => new Set());
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const idMascota = mascotaElegidaId ?? mascotaActiva?.id ?? mascotas[0]?.id ?? null;
  const mascota = mascotas.find((m) => m.id === idMascota) ?? null;
  const ciudad = usuario?.ubicacion || usuario?.ciudad || null;

  const cargar = useCallback(async () => {
    try {
      setEventos(await traerEventos(ciudad));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [ciudad]);

  useEffect(() => {
    if (!cargandoUsuario) cargar();
  }, [cargandoUsuario, cargar]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  useFocusEffect(useCallback(() => {
    let vigente = true;
    if (!idMascota) { setAgregados(new Set()); return undefined; }
    getEventosCalendario(idMascota)
      .then((guardados) => {
        if (vigente) setAgregados(new Set(guardados.filter((e) => e.origen === 'eventos').map((e) => e.origenId)));
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [idMascota]));

  const agregar = useCallback(async (evento) => {
    if (agregados.has(evento.id)) return;
    if (!idMascota) throw new Error('sin_mascota');
    setProcesando((prev) => new Set(prev).add(evento.id));
    try {
      await agregarEventoCalendario(idMascota, {
        titulo: evento.titulo,
        descripcion: [evento.descripcion, `📍 ${evento.ubicacion_nombre}`].filter(Boolean).join('\n'),
        fecha_hora: new Date(evento.fecha_hora).toISOString(),
        tipo: 'Evento',
        origenId: evento.id,
        emoji: '🎉',
        color: colores.violeta,
      });
      setAgregados((prev) => new Set(prev).add(evento.id));
    } finally {
      setProcesando((prev) => { const next = new Set(prev); next.delete(evento.id); return next; });
    }
  }, [agregados, idMascota]);

  const eventosParaMascota = useMemo(
    () => eventos.filter((e) => eventoAplicaAMascota(e, mascota)),
    [eventos, mascota],
  );

  return {
    usuario, mascotaActiva, mascotas, mascota, idMascota, elegirMascota: setMascotaElegidaId,
    eventos: eventosParaMascota, agregados, procesando, agregar,
    cargando, refrescando, refrescar, error, reintentar: cargar,
  };
}
