import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { HORARIOS_DEFAULT, serviciosDe } from '../../domain/paseos';
import { errorApp } from '../comun';

export function mapPerfil(row, user) {
  return {
    idUser: row.id_user,
    nombre: user?.Nombre ?? '',
    apellido: user?.Apellido ?? '',
    foto: user?.FotoPerfil ?? null,
    telefono: user?.Telefono ?? null,
    bio: row.bio ?? '',
    zona: row.zona ?? '',
    zonas: row.zonas ?? [],
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    radioKm: Number(row.radio_km ?? 3),
    servicios: serviciosDe({
      servicios: row.servicios, precio30: row.precio_30, precio60: row.precio_60,
    }),
    maxPerros: row.max_perros ?? 3,
    tamanos: row.tamanos ?? [],
    experienciaAnios: row.experiencia_anios ?? 0,
    disponible: !!row.disponible,
    horarios: { ...HORARIOS_DEFAULT(), ...(row.horarios ?? {}) },
    verificado: !!row.verificado,
    desde: row.creado_en ?? null,
  };
}

export async function fetchPerfilPaseador() {
  const id = getCurrentUserId();
  const [{ data: row, error }, { data: user }] = await Promise.all([
    supabase.from('paseador_perfil').select('*').eq('id_user', id).maybeSingle(),
    supabase.from('User').select('Nombre, Apellido, FotoPerfil, Telefono').eq('Id_User', id).maybeSingle(),
  ]);
  if (error) throw errorApp('error_base', error);
  if (!row) return null;
  return mapPerfil(row, user);
}

export async function actualizarPerfilPaseador(campos) {
  const columnas = {
    bio: 'bio', zona: 'zona', zonas: 'zonas', radioKm: 'radio_km', lat: 'lat', lng: 'lng',
    servicios: 'servicios', maxPerros: 'max_perros',
    tamanos: 'tamanos', experienciaAnios: 'experiencia_anios',
    disponible: 'disponible', horarios: 'horarios',
  };
  const fila = { actualizado_en: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (columnas[k]) fila[columnas[k]] = v; });
  const { error } = await supabase.from('paseador_perfil').update(fila).eq('id_user', getCurrentUserId());
  if (error) throw error;
}

export function setDisponible(disponible) {
  return actualizarPerfilPaseador({ disponible });
}
