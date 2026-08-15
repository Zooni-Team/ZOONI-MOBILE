/**
 * calendarioStore.js — Calendario de Cuidados sobre Supabase (tabla eventos_calendario)
 *
 * Reemplaza el storage local (SecureStore/localStorage) que usaban
 * CalendarioScreen y EventosScreen mientras no había backend conectado.
 * Los eventos ahora persisten en Postgres, filtrados por mascota_id.
 */

import { supabase } from '../lib/supabase';

/*
  Acá vivía un "sembrado inicial" que, la primera vez que se abría Eventos,
  copiaba solo al calendario todos los eventos marcados `ya_en_calendario`.
  Se eliminó: agregaba eventos que el usuario nunca había agregado (por eso
  aparecían como "✓ Agregado al calendario" sin haberlos tocado) y, al correr
  desde dos lugares a la vez, los insertaba por duplicado. Ahora al calendario
  solo entra lo que el usuario agrega explícitamente.
*/

function mapRow(row) {
  return {
    id: row.id,
    mascotaId: row.mascota_id,
    origen: row.origen,
    origenId: row.origen_evento_id ?? undefined,
    titulo: row.titulo,
    descripcion: row.descripcion,
    fecha_hora: row.fecha_hora,
    tipo: row.tipo,
    emoji: row.emoji,
    color: row.color,
  };
}

/** Devuelve los eventos del calendario de `petId`, o `defaults` si falla o no hay petId. */
export async function getEventosCalendario(petId, defaults = []) {
  if (!petId) return defaults;
  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('*')
    .eq('mascota_id', petId)
    .order('fecha_hora', { ascending: true });
  if (error || !data) return defaults;
  return data.map(mapRow);
}

/** Crea un evento manual (alta desde CalendarioScreen). */
export async function crearEventoCalendario(petId, datos) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      mascota_id: petId,
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      fecha_hora: datos.fecha_hora,
      tipo: datos.tipo ?? 'Otro',
      emoji: datos.emoji ?? null,
      color: datos.color ?? null,
      origen: 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Edita un evento manual existente. */
export async function actualizarEventoCalendario(eventoId, datos) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .update({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      fecha_hora: datos.fecha_hora,
      tipo: datos.tipo ?? 'Otro',
      emoji: datos.emoji ?? null,
      color: datos.color ?? null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', eventoId)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Elimina un evento del calendario. */
export async function eliminarEventoCalendario(eventoId) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('id', eventoId);
  if (error) throw error;
}

/**
 * Agrega un evento público (de EventosScreen) al calendario de `petId`.
 * `evento.origenId` es el id del evento público en la tabla `eventos`.
 *
 * Es IDEMPOTENTE: si ese evento ya está en el calendario de esa mascota,
 * devuelve el que ya existe en vez de insertar otro.
 *
 * Antes insertaba a ciegas y el mismo evento terminaba duplicado por varios
 * caminos a la vez: el sembrado automático corría dos veces (una al cargar la
 * pantalla y otra al enfocarla) y un doble toque en "Agregar" también metía dos
 * filas. La comprobación va acá, en el store, para que no dependa de que cada
 * pantalla se acuerde de hacerla.
 *
 * La base además tiene un índice único que lo garantiza aunque dos
 * dispositivos escriban a la vez (migración 031).
 */
export async function agregarEventoCalendario(petId, evento) {
  if (!petId) throw new Error('Falta la mascota a la que agregar el evento');

  if (evento.origenId != null) {
    const { data: existente } = await supabase
      .from('eventos_calendario')
      .select('*')
      .eq('mascota_id', petId)
      .eq('origen', 'eventos')
      .eq('origen_evento_id', evento.origenId)
      .limit(1);
    if (existente?.length) return mapRow(existente[0]);
  }

  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      mascota_id: petId,
      titulo: evento.titulo,
      descripcion: evento.descripcion ?? null,
      fecha_hora: evento.fecha_hora,
      tipo: evento.tipo ?? 'Evento',
      emoji: evento.emoji ?? null,
      color: evento.color ?? null,
      origen: 'eventos',
      origen_evento_id: evento.origenId ?? null,
    })
    .select()
    .single();

  // 23505 = el índice único lo frenó (dos inserciones simultáneas). No es un
  // error para el usuario: el evento quedó en el calendario igual.
  if (error?.code === '23505' && evento.origenId != null) {
    const { data: yaEsta } = await supabase
      .from('eventos_calendario')
      .select('*')
      .eq('mascota_id', petId)
      .eq('origen', 'eventos')
      .eq('origen_evento_id', evento.origenId)
      .limit(1);
    if (yaEsta?.length) return mapRow(yaEsta[0]);
  }
  if (error) throw error;
  return mapRow(data);
}

/** Quita del calendario de `petId` el evento público `origenId` (des-agregar). */
export async function quitarEventoDelCalendario(petId, origenId) {
  const { error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('mascota_id', petId)
    .eq('origen', 'eventos')
    .eq('origen_evento_id', origenId);
  if (error) throw error;
}
