import { supabase } from '../lib/supabase';

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

export async function eliminarEventoCalendario(eventoId) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('id', eventoId);
  if (error) throw error;
}

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

export async function quitarEventoDelCalendario(petId, origenId) {
  const { error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('mascota_id', petId)
    .eq('origen', 'eventos')
    .eq('origen_evento_id', origenId);
  if (error) throw error;
}
