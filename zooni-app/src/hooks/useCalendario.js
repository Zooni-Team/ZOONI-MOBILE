/**
 * useCalendario.js — Datos del Calendario de Cuidados: las mascotas del
 * usuario, de cuál se está viendo el calendario y sus recordatorios (tabla
 * eventos_calendario, vía services/calendarioStore).
 *
 * Cada mascota tiene su propio calendario. La lista se relee cuando cambia la
 * mascota y cada vez que la pantalla vuelve a tener foco (por ejemplo al
 * volver de Eventos después de sumar uno).
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';

import {
  actualizarEventoCalendario, crearEventoCalendario, eliminarEventoCalendario, getEventosCalendario,
} from '../services/calendarioStore';
import { useMisMascotas } from './useMisMascotas';
import { useUsuarioActivo } from './useUsuarioActivo';

const porFecha = (a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora);

export function useCalendario() {
  const route = useRoute();
  const { usuario, mascotaActiva } = useUsuarioActivo();
  const { mascotas, cargando: cargandoMascotas } = useMisMascotas();
  const [mascotaElegidaId, setMascotaElegidaId] = useState(route.params?.petId ?? null);
  const [recordatorios, setRecordatorios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // La que vino por parámetro o eligió el usuario; si no, la activa; si no, la primera.
  const idMascota = mascotaElegidaId ?? mascotaActiva?.id ?? mascotas[0]?.id ?? null;

  const cargar = useCallback(async () => {
    const lista = idMascota ? await getEventosCalendario(idMascota) : [];
    setRecordatorios(lista.slice().sort(porFecha));
    setCargando(false);
  }, [idMascota]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  /** Crea el recordatorio en el calendario de `paraMascota`. */
  const crear = useCallback(async (datos, paraMascota) => {
    const nuevo = await crearEventoCalendario(paraMascota, datos);
    // Si es de OTRA mascota, se pasa a su calendario para que se vea que quedó.
    if (paraMascota !== idMascota) setMascotaElegidaId(paraMascota);
    else setRecordatorios((prev) => [...prev, nuevo].sort(porFecha));
  }, [idMascota]);

  const editar = useCallback(async (id, datos) => {
    const editado = await actualizarEventoCalendario(id, datos);
    setRecordatorios((prev) => prev.map((r) => (r.id === id ? editado : r)).sort(porFecha));
  }, []);

  const eliminar = useCallback(async (id) => {
    await eliminarEventoCalendario(id);
    setRecordatorios((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    usuario, mascotaActiva, mascotas, idMascota, elegirMascota: setMascotaElegidaId,
    recordatorios, crear, editar, eliminar,
    // Sin mascota todavía resuelta no hay nada que esperar de la lista
    cargando: cargando || (cargandoMascotas && !idMascota),
    refrescando, refrescar,
  };
}
